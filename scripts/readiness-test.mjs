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
const { buildPublicReadiness, buildReadiness, evaluateLegalContent, evaluatePricingContent } =
  await import("../config/readiness.js");

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
  // legal_placeholders_replaced/pricing_visible depend on on-disk page content, not env vars,
  // so they are verified separately below with synthetic content rather than folded into this
  // env-completeness assertion (real placeholder pages should legitimately fail this check
  // until someone replaces them, independent of how the rest of the environment is configured).
  const contentDependentChecks = new Set(["legal_placeholders_replaced", "pricing_visible"]);
  const failedCriticalChecks = complete.checks.filter(
    (check) =>
      check.severity === "critical" && !check.done && !contentDependentChecks.has(check.id),
  );
  assert(
    failedCriticalChecks.length === 0,
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
    publicReadiness.criticalReady === complete.criticalReady,
    "Public readiness must expose the same critical readiness summary as the full readiness report.",
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

  const placeholderLegal = evaluateLegalContent([
    "<p>Contacto: [TU EMAIL DE SOPORTE]</p>",
    "<p>Sin placeholders aquí.</p>",
    "<p>Otra página sin placeholders.</p>",
  ]);
  assert(
    placeholderLegal.legalPlaceholdersReplaced === false,
    "A remaining [placeholder] token must fail the legal content check.",
  );

  const cleanLegal = evaluateLegalContent([
    "<p>Contacto: soporte@ejemplo.com</p>",
    "<p>Sin placeholders aquí.</p>",
    "<p>Otra página sin placeholders.</p>",
  ]);
  assert(
    cleanLegal.legalPlaceholdersReplaced === true,
    "Legal pages with no [placeholder] tokens must pass the legal content check.",
  );

  const missingLegal = evaluateLegalContent([null, "<p>Sin placeholders aquí.</p>", null]);
  assert(
    missingLegal.legalPagesFound === false && missingLegal.legalPlaceholdersReplaced === false,
    "A missing legal page file must fail the legal content check.",
  );

  const placeholderPricing = evaluatePricingContent("<span>[PRECIO]/mes</span>");
  assert(
    placeholderPricing.pricingVisible === false,
    "A remaining [PRECIO] token must fail the pricing visibility check.",
  );

  const realPricing = evaluatePricingContent("<span>$29/mes</span>");
  assert(
    realPricing.pricingVisible === true,
    "A real price with no placeholder must pass the pricing visibility check.",
  );

  console.info("Production readiness guard passed");
} finally {
  restoreEnv();
}
