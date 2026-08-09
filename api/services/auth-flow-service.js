import {
  authenticateUser,
  createSessionToken,
  createUser,
  getSessionContext,
  getTrustedDeviceToken,
  listUserSessions,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeRequestSession,
  revokeUserSession,
  verifyTrustedDeviceToken,
} from "./auth-service.js";
import { getMfaEnv } from "../../config/env.js";
import { createAdminMfaChallenge, verifyAdminMfaChallenge } from "./mfa-service.js";
import { getTurnstileEnv } from "../../config/env.js";
import { PublicInquirySecurityError, validateTurnstileToken } from "./turnstile-service.js";
import { assertLoginBotProtection, createLoginGuardChallenge } from "./login-guard-service.js";

export function getAuthErrorStatus(error) {
  if (error.statusCode) return error.statusCode;
  const message = String(error.message || "");
  if (message.includes("AUTH_SECRET")) return 500;
  if (message.includes("Invalid")) return 401;
  if (
    /^(A valid email|Business name|Email is too long|Password must contain|Password is too long|Unknown plan|A user with this email|Completa|Verificación|formulario|Envío|MFA|Solicitud)/.test(
      message,
    )
  ) {
    return 400;
  }
  return 500;
}

/** Only same-origin relative paths for post-login redirect. */
export function sanitizeNextPath(next) {
  const raw = String(next || "").trim();
  if (!raw) return "/app";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/app";
  if (raw.includes("\\") || raw.includes("\0")) return "/app";
  // Block protocol-relative and external
  if (raw.includes("://")) return "/app";
  const allowed =
    raw === "/app" ||
    raw.startsWith("/app?") ||
    raw === "/dashboard" ||
    raw.startsWith("/dashboard") ||
    raw === "/crm" ||
    raw.startsWith("/crm") ||
    raw.startsWith("/aceptar-invitacion") ||
    raw.startsWith("/restablecer-acceso");
  return allowed ? raw.slice(0, 512) : "/app";
}

/**
 * Layered bot protection: honeypot + timing + Turnstile and/or Luenio Guard.
 */
async function requireLoginBotProtection(body, request, action = "login") {
  const guard = assertLoginBotProtection(body, request);
  const turnstile = getTurnstileEnv();
  const token = String(body.turnstileToken || "").trim();
  const mustValidateTurnstile =
    (turnstile.required && turnstile.siteKey && turnstile.secretKey) ||
    (guard.mode === "turnstile" && token);

  if (mustValidateTurnstile) {
    try {
      await validateTurnstileToken({
        token: body.turnstileToken,
        clientIp: request.clientIp,
        action,
      });
    } catch (error) {
      if (error instanceof PublicInquirySecurityError) {
        const err = new Error(
          error.message === "Complete the security verification."
            ? "Completa la verificación anti-bot (Turnstile)."
            : error.message || "Verificación anti-bot fallida.",
        );
        err.statusCode = error.statusCode || 400;
        err.code = error.code || "TURNSTILE_FAILED";
        err.publicMessage = err.message;
        throw err;
      }
      throw error;
    }
  }
  return guard;
}

export function getLoginGuardChallenge(request) {
  return {
    status: 200,
    body: {
      ok: true,
      ...createLoginGuardChallenge(request),
      features: {
        honeypot: true,
        formTiming: true,
        lockout: true,
        httpOnlySession: true,
        mfaAdmin: true,
        trustedDevice: true,
      },
    },
  };
}

export async function getAuthSession(request) {
  const ctx = await getSessionContext(request);
  if (!ctx) {
    return {
      status: 200,
      body: { ok: true, user: null, authenticated: false, sessionId: null },
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      user: ctx.user,
      authenticated: true,
      sessionId: ctx.sessionId,
    },
  };
}

export async function registerAuthSession(body = {}) {
  const user = await createUser({
    email: body.email,
    password: body.password,
    businessName: body.businessName,
    plan: body.plan,
  });

  return {
    status: 201,
    body: { ok: true, user, authenticated: true, next: "/app" },
    sessionToken: await createSessionToken(user),
  };
}

function mfaDeliveryReady(mfa = getMfaEnv()) {
  return Boolean(mfa.webhookUrl && mfa.webhookToken && String(mfa.webhookToken).length >= 16);
}

export async function loginAuthSession(body = {}, request = {}) {
  await requireLoginBotProtection(body, request, "login");

  let user;
  try {
    user = await authenticateUser({
      email: body.email,
      password: body.password,
      clientIp: request.clientIp,
    });
  } catch (error) {
    // Prefer human messages already on the error; map opaque storage failures
    if (error.statusCode === 503 || error.publicMessage) {
      const err = new Error(
        error.publicMessage || "No pudimos validar el acceso. Intenta de nuevo en un momento.",
      );
      err.statusCode = error.statusCode || 503;
      err.code = error.code || "AUTH_STORAGE";
      err.retryAfterSeconds = error.retryAfterSeconds;
      throw err;
    }
    throw error;
  }

  const next = sanitizeNextPath(body.next);
  const mfa = getMfaEnv();
  const trusted = verifyTrustedDeviceToken(getTrustedDeviceToken(request), user.id);
  const wantsMfa = user.role === "admin" && mfa.requiredForAdmins && !trusted;

  if (wantsMfa) {
    if (!mfaDeliveryReady(mfa)) {
      const err = new Error(
        "MFA de administrador está activo pero el envío del código no está configurado (AUTH_MFA_WEBHOOK_URL / TOKEN).",
      );
      err.statusCode = 503;
      err.code = "MFA_NOT_CONFIGURED";
      err.publicMessage = err.message;
      throw err;
    }
    try {
      const challenge = await createAdminMfaChallenge(user);
      return {
        status: 202,
        body: {
          ok: true,
          authenticated: false,
          mfaRequired: true,
          next,
          ...challenge,
        },
      };
    } catch (error) {
      const err = new Error(
        error.message?.includes("Multi-factor") || error.statusCode === 503
          ? "No pudimos enviar el código MFA. Revisa el webhook de correo o intenta más tarde."
          : error.message || "Error al iniciar MFA.",
      );
      err.statusCode = error.statusCode || 503;
      err.code = error.code || "MFA_DELIVERY_FAILED";
      err.publicMessage = err.message;
      throw err;
    }
  }

  try {
    return {
      status: 200,
      body: {
        ok: true,
        user,
        authenticated: true,
        next,
        mfaSkipped: Boolean(trusted && user.role === "admin"),
      },
      sessionToken: await createSessionToken(user, {
        clientIp: request.clientIp,
        userAgent: request.headers?.["user-agent"],
      }),
    };
  } catch (error) {
    const err = new Error(
      error.publicMessage || "Acceso validado pero no se pudo crear la sesión. Intenta de nuevo.",
    );
    err.statusCode = error.statusCode || 503;
    err.code = "SESSION_CREATE_FAILED";
    err.publicMessage = err.message;
    throw err;
  }
}

export async function verifyMfaAuthSession(body = {}, request = {}) {
  const user = await verifyAdminMfaChallenge({
    challengeId: body.challengeId,
    code: body.code,
  });
  const next = sanitizeNextPath(body.next);
  const rememberDevice = Boolean(body.rememberDevice);

  return {
    status: 200,
    body: { ok: true, user, authenticated: true, next },
    sessionToken: await createSessionToken(user, {
      clientIp: request.clientIp,
      userAgent: request.headers?.["user-agent"],
    }),
    trustedDeviceUserId: rememberDevice ? user.id : null,
  };
}

export async function logoutAuthSession(request) {
  await revokeRequestSession(request);
  return {
    status: 200,
    body: { ok: true, authenticated: false },
    clearSession: true,
    clearTrustedDevice: true,
  };
}

export async function listSessionsAuth(request) {
  const ctx = await getSessionContext(request);
  if (!ctx) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  const sessions = await listUserSessions(ctx.user.id, ctx.sessionId);
  return {
    status: 200,
    body: { ok: true, data: sessions, currentSessionId: ctx.sessionId },
  };
}

export async function revokeSessionAuth(body = {}, request = {}) {
  const ctx = await getSessionContext(request);
  if (!ctx) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    const error = new Error("sessionId required");
    error.statusCode = 400;
    throw error;
  }
  const ok = await revokeUserSession(ctx.user.id, sessionId);
  if (!ok) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  const revokedCurrent = sessionId === ctx.sessionId;
  return {
    status: 200,
    body: { ok: true, revokedCurrent },
    clearSession: revokedCurrent,
    clearTrustedDevice: revokedCurrent,
  };
}

export async function revokeOtherSessionsAuth(request) {
  const ctx = await getSessionContext(request);
  if (!ctx) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  const count = await revokeOtherUserSessions(ctx.user.id, ctx.sessionId);
  return {
    status: 200,
    body: { ok: true, revoked: count },
  };
}

export async function revokeAllSessionsAuth(request) {
  const ctx = await getSessionContext(request);
  if (!ctx) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  await revokeAllUserSessions(ctx.user.id);
  return {
    status: 200,
    body: { ok: true },
    clearSession: true,
    clearTrustedDevice: true,
  };
}
