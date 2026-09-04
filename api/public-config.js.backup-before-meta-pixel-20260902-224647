import {
  getAnalyticsEnv,
  getCrmEnv,
  getEnv,
  getStripeEnv,
  getTurnstileEnv,
} from "../config/env.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const analytics = getAnalyticsEnv();
  const crm = getCrmEnv();
  const stripe = getStripeEnv();
  const turnstile = getTurnstileEnv();
  // Public browser DSN only (never expose secret server keys here)
  const sentryDsn = getEnv("SENTRY_DSN_PUBLIC") || getEnv("SENTRY_DSN") || null;
  return response.status(200).json({
    gaMeasurementId: analytics.gaMeasurementId || null,
    analyticsEnabled: Boolean(analytics.gaMeasurementId),
    agencyCrmEnabled: crm.enabled,
    publicBillingEnabled: stripe.publicBillingEnabled,
    turnstileSiteKey: turnstile.siteKey || null,
    turnstileRequired: turnstile.required,
    sentryDsn,
    environment: getEnv("SENTRY_ENVIRONMENT") || getEnv("NODE_ENV") || "development",
  });
}
