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
  return {
    host: getEnv("HOST", "127.0.0.1"),
    port: getNumberEnv("PORT", 4180),
    rateLimitMax: getNumberEnv("RATE_LIMIT_MAX", 120),
    sensitiveRateLimitMax: getNumberEnv("SENSITIVE_RATE_LIMIT_MAX", 30),
    maxBodyBytes: getNumberEnv("MAX_BODY_BYTES", 1_000_000),
    appUrl: getEnv("APP_URL"),
    serveDist: isProduction() || getBooleanEnv("SERVE_DIST", false),
  };
}

export function getSecurityConfig() {
  return {
    authSecret: getEnv("AUTH_SECRET") || getEnv("SESSION_SECRET"),
    cookieSecure: isProduction() || getBooleanEnv("COOKIE_SECURE", false),
    nodeEnv: getEnv("NODE_ENV", "development"),
    requireSupabase: getBooleanEnv("REQUIRE_SUPABASE", false),
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
  };
}

export function getContactEnv() {
  return {
    webhookUrl: getEnv("CONTACT_WEBHOOK_URL"),
  };
}
