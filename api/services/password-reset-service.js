import crypto from "node:crypto";
import { getInvitationEnv, getServerConfig, isProduction } from "../../config/env.js";
import { generateRecordId } from "../../core/ids.js";
import {
  getSupabaseConfig,
  readLocalState,
  supabaseRequest,
  writeLocalState,
} from "../../db/storage.js";
import { createPasswordHash, findUserByEmail, updateUserPassword } from "./auth-service.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

const resetTtlMs = 60 * 60 * 1_000;
const resetRequestCooldownMs = 60 * 1_000;
const hash = (token) =>
  crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");

async function deliverReset(email, resetUrl, expiresAt) {
  const { webhookUrl, webhookToken } = getInvitationEnv();
  if (!webhookUrl) return;
  if (isProduction() && !webhookToken) return;
  try {
    await fetchWithTimeout(getSecureOutboundUrl(webhookUrl, "Password reset webhook URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({ type: "password_reset", email, resetUrl, expiresAt }),
    });
  } catch {
    // Reset requests remain enumeration-safe even when delivery is unavailable.
  }
}

export async function requestPasswordReset(emailInput) {
  const email = String(emailInput || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const user = await findUserByEmail(email);
  if (!user) return;
  const recentRecords = getSupabaseConfig()
    ? await supabaseRequest(
        `password_resets?user_id=eq.${encodeURIComponent(user.id)}&select=created_at&order=created_at.desc&limit=1`,
      )
    : (readLocalState().passwordResets || [])
        .filter((item) => item.userId === user.id)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const lastCreatedAt = recentRecords[0]?.createdAt || recentRecords[0]?.created_at;
  if (lastCreatedAt && Date.now() - new Date(lastCreatedAt).getTime() < resetRequestCooldownMs) {
    return;
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const record = {
    id: generateRecordId("reset"),
    userId: user.id,
    tokenHash: hash(token),
    status: "pending",
    expiresAt: new Date(Date.now() + resetTtlMs).toISOString(),
    createdAt: new Date().toISOString(),
  };
  if (getSupabaseConfig()) {
    await supabaseRequest(
      `password_resets?user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "expired" }),
      },
    );
    await supabaseRequest("password_resets", {
      method: "POST",
      body: JSON.stringify({
        id: record.id,
        user_id: record.userId,
        token_hash: record.tokenHash,
        status: record.status,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
      }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({
      ...database,
      passwordResets: [
        record,
        ...(database.passwordResets || []).map((item) =>
          item.userId === user.id && item.status === "pending"
            ? { ...item, status: "expired" }
            : item,
        ),
      ],
    });
  }
  const appUrl = getServerConfig().appUrl || "http://127.0.0.1:4180";
  const resetUrl = new URL(
    `/restablecer-acceso#token=${encodeURIComponent(token)}`,
    appUrl,
  ).toString();
  await deliverReset(user.email, resetUrl, record.expiresAt);
}

export async function confirmPasswordReset({ token, password }) {
  const rawToken = String(token || "");
  if (rawToken.length < 32 || rawToken.length > 256) throw new Error("Reset link is invalid.");
  const tokenHash = hash(token);
  const record = getSupabaseConfig()
    ? (
        await supabaseRequest(
          `password_resets?token_hash=eq.${encodeURIComponent(tokenHash)}&select=*&limit=1`,
        )
      )[0]
    : (readLocalState().passwordResets || []).find((item) => item.tokenHash === tokenHash);
  if (!record) throw new Error("Reset link is invalid.");
  const status = record.status;
  const expiresAt = record.expiresAt || record.expires_at;
  const userId = record.userId || record.user_id;
  if (status !== "pending") throw new Error("Reset link is no longer available.");
  if (new Date(expiresAt).getTime() <= Date.now()) throw new Error("Reset link has expired.");

  if (getSupabaseConfig()) {
    try {
      await supabaseRequest("rpc/luenio_consume_password_reset", {
        method: "POST",
        body: JSON.stringify({
          p_token_hash: tokenHash,
          p_password_hash: await createPasswordHash(password),
          p_now: new Date().toISOString(),
        }),
      });
      return;
    } catch (error) {
      if (error.databaseCode === "RESET_EXPIRED") throw new Error("Reset link has expired.");
      if (error.databaseCode === "RESET_UNAVAILABLE")
        throw new Error("Reset link is no longer available.");
      if (error.databaseCode === "RESET_INVALID") throw new Error("Reset link is invalid.");
      throw error;
    }
  }

  await updateUserPassword(userId, password);
  const usedAt = new Date().toISOString();
  const database = readLocalState();
  writeLocalState({
    ...database,
    passwordResets: (database.passwordResets || []).map((item) =>
      item.id === record.id ? { ...item, status: "used", usedAt } : item,
    ),
  });
}
