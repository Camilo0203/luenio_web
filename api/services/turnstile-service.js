import { getTurnstileEnv } from "../../config/env.js";

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const minimumFormFillMs = 1_500;
const maximumFormAgeMs = 2 * 60 * 60 * 1_000;

export class PublicInquirySecurityError extends Error {
  constructor(message, statusCode = 400, code = "SECURITY_VALIDATION_FAILED") {
    super(message);
    this.name = "PublicInquirySecurityError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validateSubmissionTiming(formStartedAt, now, required) {
  if (!formStartedAt && !required) return;
  const startedAt = new Date(formStartedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    throw new PublicInquirySecurityError("Invalid form session.");
  }

  const elapsed = now - startedAt;
  if (elapsed < minimumFormFillMs) {
    throw new PublicInquirySecurityError("Form submitted too quickly.");
  }
  if (elapsed > maximumFormAgeMs) {
    throw new PublicInquirySecurityError("Form session expired.");
  }
}

async function callSiteverify({ token, secretKey, remoteIp, fetchImpl }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(siteverifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
        idempotency_key: crypto.randomUUID(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new PublicInquirySecurityError("Verification service unavailable.", 503);
    }
    return response.json();
  } catch (error) {
    if (error instanceof PublicInquirySecurityError) throw error;
    throw new PublicInquirySecurityError("Verification service unavailable.", 503);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validatePublicInquirySecurity({
  body = {},
  clientIp,
  now = Date.now(),
  fetchImpl = fetch,
  config = getTurnstileEnv(),
} = {}) {
  if (String(body.website || "").trim()) {
    throw new PublicInquirySecurityError("Automated submission rejected.");
  }

  validateSubmissionTiming(body.formStartedAt, now, config.required);
  if (!config.required) return { valid: true, skipped: true };

  if (!config.siteKey || !config.secretKey) {
    throw new PublicInquirySecurityError("Verification is not configured.", 503);
  }

  const token = String(body.turnstileToken || "").trim();
  if (!token || token.length > 2_048) {
    throw new PublicInquirySecurityError("Complete the security verification.");
  }

  const result = await callSiteverify({
    token,
    secretKey: config.secretKey,
    remoteIp: clientIp,
    fetchImpl,
  });
  const hostname = String(result.hostname || "").toLowerCase();
  const hostnameAllowed = config.allowedHostnames.includes(hostname);
  const actionAllowed = result.action === "contact";

  if (!result.success || !hostnameAllowed || !actionAllowed) {
    throw new PublicInquirySecurityError("Security verification failed.");
  }

  return { valid: true, hostname, action: result.action };
}

/**
 * Generic Turnstile check for auth surfaces (login, password reset, invite).
 * Skips when Turnstile is not required (local dev).
 */
export async function validateTurnstileToken({
  token,
  clientIp,
  action = "login",
  fetchImpl = fetch,
  config = getTurnstileEnv(),
} = {}) {
  if (!config.required) return { valid: true, skipped: true };

  if (!config.siteKey || !config.secretKey) {
    throw new PublicInquirySecurityError("Verification is not configured.", 503);
  }

  const value = String(token || "").trim();
  if (!value || value.length > 2_048) {
    throw new PublicInquirySecurityError("Complete the security verification.");
  }

  const result = await callSiteverify({
    token: value,
    secretKey: config.secretKey,
    remoteIp: clientIp,
    fetchImpl,
  });
  const hostname = String(result.hostname || "").toLowerCase();
  const hostnameAllowed = config.allowedHostnames.includes(hostname);
  const expected = String(action || "login");
  const actionAllowed = result.action === expected;

  if (!result.success || !hostnameAllowed || !actionAllowed) {
    throw new PublicInquirySecurityError("Security verification failed.");
  }

  return { valid: true, hostname, action: result.action };
}
