export function getEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export function hasEnv(name) {
  return Boolean(process.env[name]);
}

export function getBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

export function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function isProduction() {
  return getEnv("NODE_ENV", "development") === "production";
}

export function getServerConfig() {
  const appUrl = getEnv("APP_URL");
  const configuredHosts = getEnv("ALLOWED_HOSTS")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (appUrl) {
    try {
      configuredHosts.push(new URL(appUrl).hostname.toLowerCase());
    } catch {
      // Readiness and production preflight report malformed APP_URL values.
    }
  }

  return {
    host: getEnv("HOST", "127.0.0.1"),
    port: getNumberEnv("PORT", 4180),
    rateLimitMax: getNumberEnv("RATE_LIMIT_MAX", 120),
    sensitiveRateLimitMax: getNumberEnv("SENSITIVE_RATE_LIMIT_MAX", 30),
    maxBodyBytes: getNumberEnv("MAX_BODY_BYTES", 64_000),
    maxUrlLength: getNumberEnv("MAX_URL_LENGTH", 2_048),
    requestTimeoutMs: getNumberEnv("REQUEST_TIMEOUT_MS", 15_000),
    headersTimeoutMs: getNumberEnv("HEADERS_TIMEOUT_MS", 10_000),
    keepAliveTimeoutMs: getNumberEnv("KEEP_ALIVE_TIMEOUT_MS", 5_000),
    maxRequestsPerSocket: getNumberEnv("MAX_REQUESTS_PER_SOCKET", 100),
    maxConnections: getNumberEnv("MAX_CONNECTIONS", 512),
    appUrl,
    allowedHosts: [...new Set(configuredHosts)],
    serveDist: isProduction() || getBooleanEnv("SERVE_DIST", false),
    publicDemoMode: getBooleanEnv("PUBLIC_DEMO_MODE", false),
  };
}

export function getSecurityConfig() {
  return {
    authSecret: getEnv("AUTH_SECRET"),
    cookieSecure: isProduction() || getBooleanEnv("COOKIE_SECURE", false),
    nodeEnv: getEnv("NODE_ENV", "development"),
    requireSupabase: getBooleanEnv("REQUIRE_SUPABASE", false),
    requireTrustedProxy: isProduction() || getBooleanEnv("REQUIRE_TRUSTED_PROXY", false),
    trustedProxySecret: getEnv("TRUSTED_PROXY_SECRET"),
    sessionTtlSeconds: getNumberEnv("SESSION_TTL_SECONDS", 24 * 60 * 60),
    passwordMinLength: getNumberEnv("PASSWORD_MIN_LENGTH", 12),
    authMaxFailures: getNumberEnv("AUTH_MAX_FAILURES", 5),
    authFailureWindowSeconds: getNumberEnv("AUTH_FAILURE_WINDOW_SECONDS", 15 * 60),
    authLockoutSeconds: getNumberEnv("AUTH_LOCKOUT_SECONDS", 15 * 60),
    healthcheckToken: getEnv("HEALTHCHECK_TOKEN"),
  };
}

export function getSupabaseEnv() {
  return {
    url: getEnv("SUPABASE_URL"),
    key: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    required: getBooleanEnv("REQUIRE_SUPABASE", false),
  };
}

export function getStripeEnv() {
  return {
    publicBillingEnabled: getBooleanEnv("ENABLE_PUBLIC_BILLING", false),
    secretKey: getEnv("STRIPE_SECRET_KEY"),
    webhookSecret: getEnv("STRIPE_WEBHOOK_SECRET"),
    starterPriceId: getEnv("STRIPE_STARTER_PRICE_ID"),
    proPriceId: getEnv("STRIPE_PRO_PRICE_ID"),
    agencyPriceId: getEnv("STRIPE_AGENCY_PRICE_ID"),
  };
}

export function getAutomationEnv() {
  return {
    webhookUrl: getEnv("LUENIO_WEBHOOK_URL"),
    crmWebhookUrl: getEnv("LUENIO_CRM_WEBHOOK_URL"),
    whatsappWebhookUrl: getEnv("LUENIO_WHATSAPP_WEBHOOK_URL"),
    emailWebhookUrl: getEnv("LUENIO_EMAIL_WEBHOOK_URL"),
    webhookToken: getEnv("AUTOMATION_WEBHOOK_TOKEN"),
  };
}

export function getContactEnv() {
  return {
    webhookUrl: getEnv("CONTACT_WEBHOOK_URL"),
    webhookToken: getEnv("CONTACT_WEBHOOK_TOKEN"),
    deliveryWorkerEnabled: getBooleanEnv("CONTACT_DELIVERY_WORKER_ENABLED", isProduction()),
    deliveryWorkerIntervalMs: getNumberEnv("CONTACT_DELIVERY_WORKER_INTERVAL_MS", 30_000),
    deliveryWorkerBatchSize: getNumberEnv("CONTACT_DELIVERY_WORKER_BATCH_SIZE", 10),
  };
}

export function getTurnstileEnv() {
  return {
    siteKey: getEnv("TURNSTILE_SITE_KEY"),
    secretKey: getEnv("TURNSTILE_SECRET_KEY"),
    required: isProduction() || getBooleanEnv("TURNSTILE_REQUIRED", false),
    allowedHostnames: getEnv("TURNSTILE_ALLOWED_HOSTNAMES", "luenio.com,staging.luenio.com")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function getAnalyticsEnv() {
  return {
    gaMeasurementId: getEnv("GA_MEASUREMENT_ID"),
  };
}

export function getCrmEnv() {
  return {
    public: getBooleanEnv("CRM_PUBLIC", false) || getBooleanEnv("CRM_API_PUBLIC", false),
    debugEndpoints: getBooleanEnv("CRM_DEBUG_ENDPOINTS", !isProduction()),
  };
}

export function getSentryEnv() {
  const serverDsn = getEnv("SENTRY_DSN_SERVER") || getEnv("SENTRY_DSN");
  const publicDsn = getEnv("SENTRY_DSN_PUBLIC");
  return {
    configured: Boolean(serverDsn && publicDsn),
    serverConfigured: Boolean(serverDsn),
    publicConfigured: Boolean(publicDsn),
  };
}

/** Optional daily digest webhook (P1). Default off; fail-closed if enabled without auth. */
export function getDigestEnv() {
  return {
    webhookUrl: getEnv("DIGEST_WEBHOOK_URL"),
    webhookToken: getEnv("DIGEST_WEBHOOK_TOKEN"),
    cronEnabled: getBooleanEnv("DIGEST_CRON_ENABLED", false),
    /** How often the worker wakes up to check if a digest is due (ms). */
    workerIntervalMs: getNumberEnv("DIGEST_WORKER_INTERVAL_MS", 60 * 60 * 1000),
    /** Minimum hours between successful sends per workspace. */
    minHoursBetweenSends: getNumberEnv("DIGEST_MIN_HOURS_BETWEEN", 20),
    /** Optional recipient hint for n8n email node. */
    recipient: getEnv("DIGEST_RECIPIENT"),
    /** Only send when dueToday or staleHot > 0 (default true). */
    onlyIfActionable: getBooleanEnv("DIGEST_ONLY_IF_ACTIONABLE", true),
  };
}

export function isDigestDeliveryConfigured(digest = getDigestEnv()) {
  if (!digest.cronEnabled) return false;
  return Boolean(
    digest.webhookUrl &&
    digest.webhookToken &&
    digest.webhookToken.length >= 32 &&
    /^https:\/\//i.test(String(digest.webhookUrl)) &&
    Number.isInteger(digest.workerIntervalMs) &&
    digest.workerIntervalMs >= 60_000 &&
    digest.workerIntervalMs <= 24 * 60 * 60 * 1000 &&
    Number.isFinite(digest.minHoursBetweenSends) &&
    digest.minHoursBetweenSends >= 1 &&
    digest.minHoursBetweenSends <= 168,
  );
}

export function getLegalEnv() {
  return {
    identityReady: getBooleanEnv("LEGAL_IDENTITY_READY", false),
  };
}

export function getInvitationEnv() {
  return {
    adminEmails: getEnv("ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    webhookUrl: getEnv("INVITATION_WEBHOOK_URL"),
    webhookToken: getEnv("INVITATION_WEBHOOK_TOKEN"),
  };
}

export function getMfaEnv() {
  return {
    requiredForAdmins: isProduction() || getBooleanEnv("ADMIN_MFA_REQUIRED", false),
    webhookUrl: getEnv("AUTH_MFA_WEBHOOK_URL"),
    webhookToken: getEnv("AUTH_MFA_WEBHOOK_TOKEN"),
  };
}
