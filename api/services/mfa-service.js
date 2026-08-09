import crypto from "node:crypto";
import { getMfaEnv, getSecurityConfig } from "../../config/env.js";
import { generateRecordId } from "../../core/ids.js";
import {
  getSupabaseConfig,
  readLocalState,
  supabaseRequest,
  writeLocalState,
} from "../../db/storage.js";
import { findUserById } from "./auth-service.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

const challengeTtlMs = 10 * 60 * 1_000;
const challengeCooldownMs = 60 * 1_000;
const maxAttempts = 5;

function hmacCode(challengeId, code) {
  const secret = getSecurityConfig().authSecret || "luenio-local-development-secret-change-me";
  return crypto.createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

function mfaError(message, statusCode = 401) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function deliverChallenge(user, challengeId, code, expiresAt) {
  const config = getMfaEnv();
  if (!config.webhookUrl || !config.webhookToken) {
    const error = mfaError(
      "MFA no configurado: falta AUTH_MFA_WEBHOOK_URL o AUTH_MFA_WEBHOOK_TOKEN.",
      503,
    );
    error.publicMessage = error.message;
    error.code = "MFA_NOT_CONFIGURED";
    throw error;
  }
  const response = await fetchWithTimeout(
    getSecureOutboundUrl(config.webhookUrl, "MFA webhook URL"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.webhookToken}`,
      },
      body: JSON.stringify({
        type: "admin_mfa",
        challengeId,
        email: user.email,
        code,
        expiresAt,
      }),
    },
  );
  if (!response.ok) {
    const error = mfaError("No se pudo enviar el código MFA al correo. Revisa n8n/SMTP.", 503);
    error.publicMessage = error.message;
    error.code = "MFA_DELIVERY_FAILED";
    throw error;
  }
}

async function expireChallenge(challengeId) {
  if (getSupabaseConfig()) {
    await supabaseRequest(`auth_challenges?id=eq.${encodeURIComponent(challengeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "expired" }),
    });
    return;
  }
  const database = readLocalState();
  writeLocalState({
    ...database,
    authChallenges: (database.authChallenges || []).map((item) =>
      item.id === challengeId ? { ...item, status: "expired" } : item,
    ),
  });
}

export async function createAdminMfaChallenge(user) {
  if (!user?.id || user.role !== "admin") throw mfaError("Administrator access required.", 403);
  const now = new Date();
  const recent = getSupabaseConfig()
    ? await supabaseRequest(
        `auth_challenges?user_id=eq.${encodeURIComponent(user.id)}&select=created_at&order=created_at.desc&limit=1`,
      )
    : (readLocalState().authChallenges || [])
        .filter((item) => item.userId === user.id)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const lastCreatedAt = recent[0]?.createdAt || recent[0]?.created_at;
  if (lastCreatedAt && now.getTime() - new Date(lastCreatedAt).getTime() < challengeCooldownMs) {
    throw mfaError("Wait before requesting another verification code.", 429);
  }

  const id = generateRecordId("mfa");
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const record = {
    id,
    userId: user.id,
    codeHash: hmacCode(id, code),
    status: "pending",
    attempts: 0,
    expiresAt: new Date(now.getTime() + challengeTtlMs).toISOString(),
    createdAt: now.toISOString(),
  };

  if (getSupabaseConfig()) {
    await supabaseRequest(
      `auth_challenges?user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "expired" }),
      },
    );
    await supabaseRequest("auth_challenges", {
      method: "POST",
      body: JSON.stringify({
        id: record.id,
        user_id: record.userId,
        code_hash: record.codeHash,
        status: record.status,
        attempts: record.attempts,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
      }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({
      ...database,
      authChallenges: [
        record,
        ...(database.authChallenges || []).map((item) =>
          item.userId === user.id && item.status === "pending"
            ? { ...item, status: "expired" }
            : item,
        ),
      ].slice(0, 10_000),
    });
  }

  try {
    await deliverChallenge(user, id, code, record.expiresAt);
  } catch (error) {
    await expireChallenge(id).catch(() => null);
    throw error;
  }
  return { challengeId: id, expiresInSeconds: Math.floor(challengeTtlMs / 1_000) };
}

export async function verifyAdminMfaChallenge({ challengeId, code }) {
  const normalizedId = String(challengeId || "").trim();
  const normalizedCode = String(code || "").trim();
  if (!/^[A-Za-z0-9_-]{12,180}$/.test(normalizedId) || !/^\d{6}$/.test(normalizedCode)) {
    throw mfaError("Verification code is invalid.");
  }
  const submittedHash = hmacCode(normalizedId, normalizedCode);

  if (getSupabaseConfig()) {
    const [result] = await supabaseRequest("rpc/luenio_consume_mfa_challenge", {
      method: "POST",
      body: JSON.stringify({
        p_challenge_id: normalizedId,
        p_code_hash: submittedHash,
        p_now: new Date().toISOString(),
        p_max_attempts: maxAttempts,
      }),
    });
    if (result?.verification_result === "locked")
      throw mfaError("Too many verification attempts. Sign in again.", 429);
    if (result?.verification_result !== "verified" || !result?.verified_user_id) {
      throw mfaError("Verification code is invalid.");
    }
    const user = await findUserById(result.verified_user_id);
    if (!user || user.role !== "admin") throw mfaError("Verification code is invalid.");
    return user;
  }

  const database = readLocalState();
  const challenge = (database.authChallenges || []).find((item) => item.id === normalizedId);
  if (
    !challenge ||
    challenge.status !== "pending" ||
    new Date(challenge.expiresAt).getTime() <= Date.now()
  ) {
    throw mfaError("Verification code is invalid.");
  }
  const valid = crypto.timingSafeEqual(
    Buffer.from(challenge.codeHash, "hex"),
    Buffer.from(submittedHash, "hex"),
  );
  const attempts = challenge.attempts + 1;
  const status = valid ? "verified" : attempts >= maxAttempts ? "locked" : "pending";
  writeLocalState({
    ...database,
    authChallenges: (database.authChallenges || []).map((item) =>
      item.id === normalizedId
        ? {
            ...item,
            attempts,
            status,
            verifiedAt: valid ? new Date().toISOString() : null,
          }
        : item,
    ),
  });
  if (!valid) {
    throw mfaError(
      status === "locked"
        ? "Too many verification attempts. Sign in again."
        : "Verification code is invalid.",
      status === "locked" ? 429 : 401,
    );
  }
  const user = await findUserById(challenge.userId);
  if (!user || user.role !== "admin") throw mfaError("Verification code is invalid.");
  return user;
}
