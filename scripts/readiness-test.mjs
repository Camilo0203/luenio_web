import fs from "node:fs";
import path from "node:path";

const envKeys = [
  "NODE_ENV",
  "HOST",
  "APP_URL",
  "SERVE_DIST",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REQUIRE_SUPABASE",
  "AUTH_SECRET",
  "ALLOWED_HOSTS",
  "REQUIRE_TRUSTED_PROXY",
  "TRUSTED_PROXY_SECRET",
  "HEALTHCHECK_TOKEN",
  "SESSION_TTL_SECONDS",
  "PASSWORD_MIN_LENGTH",
  "ADMIN_MFA_REQUIRED",
  "AUTH_MFA_WEBHOOK_URL",
  "AUTH_MFA_WEBHOOK_TOKEN",
  "COOKIE_SECURE",
  "ENABLE_PUBLIC_BILLING",
  "ENABLE_AGENCY_CRM",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_AGENCY_PRICE_ID",
  "RATE_LIMIT_MAX",
  "SENSITIVE_RATE_LIMIT_MAX",
  "CONTACT_WEBHOOK_URL",
  "CONTACT_WEBHOOK_TOKEN",
  "CONTACT_DELIVERY_WORKER_ENABLED",
  "CONTACT_DELIVERY_WORKER_INTERVAL_MS",
  "CONTACT_DELIVERY_WORKER_BATCH_SIZE",
  "AUTOMATION_WEBHOOK_TOKEN",
  "LUENIO_WEBHOOK_URL",
  "LUENIO_CRM_WEBHOOK_URL",
  "LUENIO_WHATSAPP_WEBHOOK_URL",
  "LUENIO_EMAIL_WEBHOOK_URL",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_REQUIRED",
  "GA_MEASUREMENT_ID",
  "SENTRY_DSN_SERVER",
  "SENTRY_DSN_PUBLIC",
  "LEGAL_IDENTITY_READY",
];

const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const { buildPublicReadiness, buildReadiness, evaluateLegalContent, evaluatePricingContent } =
  await import("../config/readiness.js");
const root = process.cwd();

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
  assert(
    incomplete.checks.find((check) => check.id === "agency_crm_launch_scope")?.done === true,
    "Agency CRM must be disabled by default for the initial launch.",
  );

  resetEnv();
  process.env.NODE_ENV = "production";
  process.env.HOST = "0.0.0.0";
  process.env.APP_URL = "https://luenio.example";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.REQUIRE_SUPABASE = "true";
  process.env.AUTH_SECRET = "long-production-auth-secret";
  process.env.ALLOWED_HOSTS = "luenio.example";
  process.env.REQUIRE_TRUSTED_PROXY = "true";
  process.env.TRUSTED_PROXY_SECRET = "trusted-proxy-secret-at-least-32-characters";
  process.env.HEALTHCHECK_TOKEN = "healthcheck-token-at-least-32-characters";
  process.env.SESSION_TTL_SECONDS = "86400";
  process.env.PASSWORD_MIN_LENGTH = "12";
  process.env.ADMIN_MFA_REQUIRED = "true";
  process.env.AUTH_MFA_WEBHOOK_URL = "https://automation.luenio.com/webhook/mfa";
  process.env.AUTH_MFA_WEBHOOK_TOKEN = "mfa-webhook-token-at-least-32-characters";
  process.env.STRIPE_SECRET_KEY = "sk_test_ready";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_ready";
  process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  process.env.STRIPE_AGENCY_PRICE_ID = "price_agency";
  process.env.RATE_LIMIT_MAX = "120";
  process.env.SENSITIVE_RATE_LIMIT_MAX = "30";
  process.env.CONTACT_WEBHOOK_URL = "https://automation.luenio.com/webhook/luenio-contact";
  process.env.CONTACT_WEBHOOK_TOKEN = "test-contact-token";
  process.env.CONTACT_DELIVERY_WORKER_ENABLED = "true";
  process.env.CONTACT_DELIVERY_WORKER_INTERVAL_MS = "30000";
  process.env.CONTACT_DELIVERY_WORKER_BATCH_SIZE = "10";
  process.env.TURNSTILE_SITE_KEY = "site-key";
  process.env.TURNSTILE_SECRET_KEY = "secret-key";
  process.env.TURNSTILE_REQUIRED = "true";
  process.env.GA_MEASUREMENT_ID = "G-TEST123";
  process.env.SENTRY_DSN_SERVER = "https://server@example.ingest.sentry.io/1";
  process.env.SENTRY_DSN_PUBLIC = "https://browser@example.ingest.sentry.io/2";
  process.env.LEGAL_IDENTITY_READY = "true";

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
    complete.billing.publicBillingEnabled === false,
    "Lead-gen launch must keep public billing disabled unless explicitly enabled.",
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

  resetEnv();
  process.env.NODE_ENV = "production";
  process.env.APP_URL = "https://luenio.example";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.REQUIRE_SUPABASE = "true";
  process.env.AUTH_SECRET = "long-production-auth-secret";
  process.env.ENABLE_PUBLIC_BILLING = "true";
  const billingRequired = buildReadiness();
  assert(
    billingRequired.checks.find((check) => check.id === "stripe")?.severity === "critical" &&
      billingRequired.checks.find((check) => check.id === "stripe")?.done === false,
    "Enabling public billing must make Stripe configuration a critical readiness check.",
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

  const structuredDataLegal = evaluateLegalContent([
    '<script type="application/ld+json">{"@graph":[{"@type":"WebPage"}]}</script><p>Copia lista.</p>',
    "<p>Sin placeholders aquí.</p>",
    "<p>Otra página sin placeholders.</p>",
  ]);
  assert(
    structuredDataLegal.legalPlaceholdersReplaced === true,
    "JSON-LD arrays must not be mistaken for unreplaced [placeholder] tokens.",
  );

  const scriptHidingPlaceholder = evaluateLegalContent([
    '<script type="application/ld+json">{"@graph":[]}</script><p>Contacto: [TU EMAIL]</p>',
    "<p>Sin placeholders aquí.</p>",
    "<p>Otra página sin placeholders.</p>",
  ]);
  assert(
    scriptHidingPlaceholder.legalPlaceholdersReplaced === false,
    "Stripping scripts must not stop the check from seeing placeholders in the visible copy.",
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

  const productionEnvExample = fs.readFileSync(path.join(root, ".env.production.example"), "utf8");
  [
    "NODE_ENV=production",
    "SERVE_DIST=true",
    "COOKIE_SECURE=true",
    "REQUIRE_SUPABASE=true",
    "ENABLE_PUBLIC_BILLING=false",
    "CONTACT_WEBHOOK_URL=",
    "CONTACT_WEBHOOK_TOKEN=",
    "CONTACT_DELIVERY_WORKER_ENABLED=true",
    "TRUSTED_PROXY_SECRET=",
    "HEALTHCHECK_TOKEN=",
    "AUTOMATION_WEBHOOK_TOKEN=",
    "ADMIN_MFA_REQUIRED=true",
    "AUTH_MFA_WEBHOOK_URL=",
    "AUTH_MFA_WEBHOOK_TOKEN=",
    "TURNSTILE_REQUIRED=true",
    "GA_MEASUREMENT_ID=",
    "LEGAL_IDENTITY_READY=false",
  ].forEach((requiredLine) => {
    assert(
      productionEnvExample.includes(requiredLine),
      `.env.production.example must include ${requiredLine}.`,
    );
  });

  const preflightSource = fs.readFileSync(
    path.join(root, "scripts", "production-preflight.mjs"),
    "utf8",
  );
  [
    "buildReadiness",
    "testStorageConnection",
    "ENABLE_PUBLIC_BILLING",
    "Configure at least one contact/automation webhook",
    "Remote /api/health must report criticalReady=true",
  ].forEach((requiredHook) => {
    assert(
      preflightSource.includes(requiredHook),
      `Production preflight must enforce ${requiredHook}.`,
    );
  });

  console.info("Production readiness guard passed");
} finally {
  restoreEnv();
}
