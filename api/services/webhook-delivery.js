import { isProduction } from "../../config/env.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Low-level POST-JSON-with-timeout webhook delivery shared by automation,
 * contact and digest services. Returns a neutral result; callers map
 * `reason` to their own status/message shape so existing consumers see no
 * behavior change.
 */
export async function deliverWebhook({
  url,
  token,
  payload,
  urlLabel = "Webhook URL",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  requireTokenInProduction = true,
}) {
  if (!url) {
    return { status: "not_configured", httpStatus: null, reason: null, errorMessage: null };
  }
  if (requireTokenInProduction && isProduction() && !token) {
    return { status: "failed", httpStatus: null, reason: "missing_token", errorMessage: null };
  }

  try {
    const response = await fetchWithTimeout(
      getSecureOutboundUrl(url, urlLabel),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );
    return {
      status: response.ok ? "sent" : "failed",
      httpStatus: response.status,
      reason: null,
      errorMessage: null,
    };
  } catch (error) {
    return {
      status: "failed",
      httpStatus: null,
      reason: "network_error",
      errorMessage: error?.message || null,
    };
  }
}
