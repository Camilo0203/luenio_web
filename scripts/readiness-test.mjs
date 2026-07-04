const envKeys = [
  "NODE_ENV",
  "HOST",
  "APP_URL",
  "SERVE_DIST",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REQUIRE_SUPABASE",
  "AUTH_SECRET",
  "COOKIE_SECURE",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_AGENCY_PRICE_ID",
  "RATE_LIMIT_MAX",
  "SENSITIVE_RATE_LIMIT_MAX",
];

const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const { buildPublicReadiness, buildReadiness } = await import("../config/readiness.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function restoreEnv() {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
}

function resetEnv() {
  envKeys.forEach((key) => delete process.env[key]);
}

try {
  resetEnv();
  process.env.REQUIRE_SUPABASE = "true";
  process.env.APP_URL = "http://localhost:4180";

  const incomplete = buildReadiness();
  assert(
    incomplete.criticalReady === false,
    "Incomplete production config must not be critical-ready.",
  );
  assert(
    incomplete.checks.find((check) => check.id === "app_url")?.done === false,
    "APP_URL must require HTTPS.",
  );
  assert(
    incomplete.checks.find((check) => check.id === "deployment_mode")?.done === false,
    "NODE_ENV production must be required.",
  );
  assert(
    incomplete.checks.find((check) => check.id === "static_assets")?.done === false,
    "Built asset serving must be required.",
  );
  assert(
    incomplete.checks.find((check) => check.id === "api_rate_limits")?.done === true,
    "Default API rate limits must be production-safe.",
  );

  resetEnv();
  process.env.NODE_ENV = "production";
  process.env.HOST = "0.0.0.0";
  process.env.APP_URL = "https://luenio.example";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.REQUIRE_SUPABASE = "true";
  process.env.AUTH_SECRET = "long-production-auth-secret";
  process.env.STRIPE_SECRET_KEY = "sk_test_ready";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_ready";
  process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  process.env.STRIPE_AGENCY_PRICE_ID = "price_agency";
  process.env.RATE_LIMIT_MAX = "120";
  process.env.SENSITIVE_RATE_LIMIT_MAX = "30";

  const complete = buildReadiness();
  const publicReadiness = buildPublicReadiness(complete);
  const failedCriticalChecks = complete.checks.filter(
    (check) => check.severity === "critical" && !check.done,
  );
  assert(
    complete.criticalReady === true,
    `Complete production config must be critical-ready: ${failedCriticalChecks.map((check) => check.id).join(", ")}`,
  );
  assert(complete.deployment.appUrlHttps === true, "Deployment status must expose HTTPS APP_URL.");
  assert(
    complete.deployment.host === "0.0.0.0",
    "Deployment status must expose configured host binding.",
  );
  assert(complete.deployment.serveDist === true, "Production mode must serve dist assets.");
  assert(
    complete.deployment.rateLimitsConfigured === true,
    "Deployment status must expose configured API rate limits.",
  );
  assert(
    publicReadiness.criticalReady === true,
    "Public readiness must expose critical readiness summary.",
  );
  assert(Array.isArray(publicReadiness.checks), "Public readiness must expose sanitized checks.");
  assert(
    !publicReadiness.security && !publicReadiness.billing && !publicReadiness.deployment,
    "Public readiness must not expose internal config blocks.",
  );

  resetEnv();
  process.env.NODE_ENV = "production";
  process.env.RATE_LIMIT_MAX = "0";
  process.env.SENSITIVE_RATE_LIMIT_MAX = "0";
  const unsafeLimits = buildReadiness();
  assert(
    unsafeLimits.checks.find((check) => check.id === "api_rate_limits")?.done === false,
    "Disabled API rate limits must fail readiness.",
  );

  console.info("Production readiness guard passed");
} finally {
  restoreEnv();
}
