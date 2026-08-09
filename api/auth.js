import {
  clearSessionCookie,
  clearTrustedDeviceCookie,
  setSessionCookie,
  setTrustedDeviceCookie,
} from "./services/auth-service.js";
import {
  getAuthErrorStatus,
  getAuthSession,
  getLoginGuardChallenge,
  listSessionsAuth,
  loginAuthSession,
  logoutAuthSession,
  revokeAllSessionsAuth,
  revokeOtherSessionsAuth,
  revokeSessionAuth,
  verifyMfaAuthSession,
} from "./services/auth-flow-service.js";
import { sendApiError } from "./services/http-response.js";

function sendAuthResult(response, result) {
  if (result.sessionToken) setSessionCookie(response, result.sessionToken);
  if (result.clearSession) clearSessionCookie(response);
  if (result.trustedDeviceUserId) {
    setTrustedDeviceCookie(response, result.trustedDeviceUserId);
  }
  if (result.clearTrustedDevice) clearTrustedDeviceCookie(response);

  if (result.body?.retryAfterSeconds || result.retryAfterSeconds) {
    const sec = result.body?.retryAfterSeconds || result.retryAfterSeconds;
    response.setHeader?.("Retry-After", String(sec));
  }

  return response.status(result.status).json(result.body);
}

export default async function handler(request, response) {
  const body = request.body || {};
  const action = body.action || request.query?.action;

  try {
    if (request.method === "GET") {
      if (request.query?.guard === "1" || request.query?.action === "guard") {
        return sendAuthResult(response, getLoginGuardChallenge(request));
      }
      const list = request.query?.sessions === "1" || request.query?.action === "sessions";
      if (list) {
        return sendAuthResult(response, await listSessionsAuth(request));
      }
      return sendAuthResult(response, await getAuthSession(request));
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (action === "register") {
      return response.status(403).json({
        ok: false,
        error: "Public registration is disabled. Access requires an invitation.",
      });
    }

    if (action === "login") {
      return sendAuthResult(response, await loginAuthSession(body, request));
    }

    if (action === "logout") {
      return sendAuthResult(response, await logoutAuthSession(request));
    }

    if (action === "verify_mfa") {
      return sendAuthResult(response, await verifyMfaAuthSession(body, request));
    }

    if (action === "list_sessions") {
      return sendAuthResult(response, await listSessionsAuth(request));
    }

    if (action === "revoke_session") {
      return sendAuthResult(response, await revokeSessionAuth(body, request));
    }

    if (action === "revoke_other_sessions") {
      return sendAuthResult(response, await revokeOtherSessionsAuth(request));
    }

    if (action === "revoke_all_sessions") {
      return sendAuthResult(response, await revokeAllSessionsAuth(request));
    }

    return response.status(400).json({ ok: false, error: "Unknown auth action." });
  } catch (error) {
    const status = getAuthErrorStatus(error);
    if (error.retryAfterSeconds) {
      response.setHeader?.("Retry-After", String(error.retryAfterSeconds));
    }
    return sendApiError(response, error, {
      status,
      extra: {
        code: error.code || undefined,
        retryAfterSeconds: error.retryAfterSeconds || undefined,
      },
    });
  }
}
