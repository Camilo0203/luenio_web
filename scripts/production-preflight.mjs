import fs from "node:fs";
import path from "node:path";
import { buildReadiness } from "../config/readiness.js";
import { testStorageConnection } from "../db/storage.js";

const root = process.cwd();
const cliArgs = process.argv.slice(2);
const checkRemote = cliArgs.includes("--remote");
const envFileIndex = cliArgs.indexOf("--env-file");
const envPath = envFileIndex >= 0 ? cliArgs[envFileIndex + 1] : "";

function fail(message) {
  console.error(`\n[production-preflight] ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function loadEnvFile() {
  assert(Boolean(envPath), "Pass an explicit environment file with --env-file /absolute/path.");
  if (!envPath) return false;
  assert(path.isAbsolute(envPath), "--env-file must be an absolute path.");
  assert(fs.existsSync(envPath), "The explicit production environment file does not exist.");
  if (!path.isAbsolute(envPath) || !fs.existsSync(envPath)) return false;

  const fileStat = fs.statSync(envPath);
  assert(fileStat.isFile(), "--env-file must reference a regular file.");
  if (process.platform !== "win32") {
    assert(
      (fileStat.mode & 0o077) === 0,
      "The production environment file must not be accessible by group or others (expected mode 600).",
    );
  }

  const loadedKeys = new Set();
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const [key, ...valueParts] = trimmed.split("=");
    const normalizedKey = key.trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(normalizedKey)) {
      fail(`Invalid environment key on line ${index + 1}.`);
      return;
    }
    if (loadedKeys.has(normalizedKey)) {
      fail(`Duplicate environment key ${normalizedKey} on line ${index + 1}.`);
      return;
    }
    loadedKeys.add(normalizedKey);
    process.env[normalizedKey] = valueParts
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "");
  });
  return !process.exitCode;
}

function hasPlaceholder(value = "") {
  return /CHANGE_ME|your-|replace-with|example|tu-dominio|127\.0\.0\.1|localhost/i.test(value);
}

function validateEnv() {
  const required = [
    "NODE_ENV",
    "SERVE_DIST",
    "PUBLIC_DEMO_MODE",
    "ENABLE_AGENCY_CRM",
    "APP_URL",
    "COOKIE_SECURE",
    "AUTH_SECRET",
    "ALLOWED_HOSTS",
    "REQUIRE_TRUSTED_PROXY",
    "TRUSTED_PROXY_SECRET",
    "HEALTHCHECK_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REQUIRE_SUPABASE",
    "RATE_LIMIT_MAX",
    "SENSITIVE_RATE_LIMIT_MAX",
    "CONTACT_WEBHOOK_URL",
    "CONTACT_WEBHOOK_TOKEN",
    "CONTACT_DELIVERY_WORKER_ENABLED",
    "CONTACT_DELIVERY_WORKER_INTERVAL_MS",
    "CONTACT_DELIVERY_WORKER_BATCH_SIZE",
    "AUTOMATION_WEBHOOK_TOKEN",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "TURNSTILE_REQUIRED",
    "GA_MEASUREMENT_ID",
    "SENTRY_DSN_SERVER",
    "SENTRY_DSN_PUBLIC",
    "SENTRY_ENVIRONMENT",
    "SENTRY_RELEASE",
    "N8N_ENCRYPTION_KEY",
    "N8N_HOST",
    "INVITATION_WEBHOOK_URL",
    "INVITATION_WEBHOOK_TOKEN",
    "ADMIN_MFA_REQUIRED",
    "AUTH_MFA_WEBHOOK_URL",
    "AUTH_MFA_WEBHOOK_TOKEN",
    "LEGAL_IDENTITY_READY",
  ];

  required.forEach((key) => {
    assert(Boolean(process.env[key]), `${key} is required in production.`);
    assert(!hasPlaceholder(process.env[key]), `${key} still looks like a placeholder.`);
  });

  assert(process.env.NODE_ENV === "production", "NODE_ENV must be production.");
  assert(process.env.SERVE_DIST === "true", "SERVE_DIST must be true.");
  assert(
    process.env.PUBLIC_DEMO_MODE === "true",
    "PUBLIC_DEMO_MODE must stay true for this public-only release.",
  );
  assert(process.env.COOKIE_SECURE === "true", "COOKIE_SECURE must be true.");
  assert(process.env.REQUIRE_SUPABASE === "true", "REQUIRE_SUPABASE must be true.");
  assert(process.env.REQUIRE_TRUSTED_PROXY === "true", "REQUIRE_TRUSTED_PROXY must be true.");
  assert(process.env.TURNSTILE_REQUIRED === "true", "TURNSTILE_REQUIRED must be true.");
  assert(process.env.ADMIN_MFA_REQUIRED === "true", "ADMIN_MFA_REQUIRED must be true.");
  assert(
    process.env.ENABLE_AGENCY_CRM === "false",
    "ENABLE_AGENCY_CRM must stay false for the initial lead-gen launch.",
  );
  assert(
    process.env.CONTACT_DELIVERY_WORKER_ENABLED === "true",
    "CONTACT_DELIVERY_WORKER_ENABLED must be true.",
  );
  assert(
    process.env.LEGAL_IDENTITY_READY === "true",
    "LEGAL_IDENTITY_READY must be true after legal review.",
  );
  // The flag is a human declaration, so pair it with something machine-checkable:
  // the legal pages carry a marker until the responsible party is actually named.
  // Without this, the flag could be flipped while the pages still only publish a
  // brand, an email and a city.
  const legalPagesStillPending = ["terminos", "privacidad", "reembolsos"].filter((page) =>
    fs
      .readFileSync(path.join(root, "apps", "web", "pages", "legal", page, "index.html"), "utf8")
      .includes("LUENIO_LEGAL_IDENTITY_PENDING"),
  );
  assert(
    legalPagesStillPending.length === 0,
    `Legal identity is still marked pending on: ${legalPagesStillPending.join(", ")}. ` +
      "Publish the responsible party's full name, tax id and physical address, remove the " +
      "LUENIO_LEGAL_IDENTITY_PENDING marker, then set LEGAL_IDENTITY_READY=true.",
  );
  assert(
    process.env.ENABLE_PUBLIC_BILLING !== "true",
    "ENABLE_PUBLIC_BILLING must stay false for the v1 lead-gen launch.",
  );
  assert(
    (process.env.AUTH_SECRET || "").length >= 32,
    "AUTH_SECRET must be at least 32 characters.",
  );
  assert(
    (process.env.CONTACT_WEBHOOK_TOKEN || "").length >= 32,
    "CONTACT_WEBHOOK_TOKEN must be at least 32 characters.",
  );
  assert(
    (process.env.N8N_ENCRYPTION_KEY || "").length >= 32,
    "N8N_ENCRYPTION_KEY must be at least 32 characters.",
  );
  const deliveryInterval = Number(process.env.CONTACT_DELIVERY_WORKER_INTERVAL_MS);
  const deliveryBatchSize = Number(process.env.CONTACT_DELIVERY_WORKER_BATCH_SIZE);
  assert(
    Number.isInteger(deliveryInterval) && deliveryInterval >= 10_000 && deliveryInterval <= 300_000,
    "CONTACT_DELIVERY_WORKER_INTERVAL_MS must be between 10000 and 300000.",
  );
  assert(
    Number.isInteger(deliveryBatchSize) && deliveryBatchSize >= 1 && deliveryBatchSize <= 50,
    "CONTACT_DELIVERY_WORKER_BATCH_SIZE must be between 1 and 50.",
  );
  [
    "TRUSTED_PROXY_SECRET",
    "HEALTHCHECK_TOKEN",
    "AUTOMATION_WEBHOOK_TOKEN",
    "INVITATION_WEBHOOK_TOKEN",
    "AUTH_MFA_WEBHOOK_TOKEN",
  ].forEach((key) => {
    assert((process.env[key] || "").length >= 32, `${key} must be at least 32 characters.`);
  });

  const secretValues = [
    "AUTH_SECRET",
    "TRUSTED_PROXY_SECRET",
    "HEALTHCHECK_TOKEN",
    "CONTACT_WEBHOOK_TOKEN",
    "AUTOMATION_WEBHOOK_TOKEN",
    "INVITATION_WEBHOOK_TOKEN",
    "AUTH_MFA_WEBHOOK_TOKEN",
    "N8N_ENCRYPTION_KEY",
  ].map((key) => process.env[key]);
  assert(
    new Set(secretValues).size === secretValues.length,
    "Every production secret must be unique; do not reuse tokens between services.",
  );

  try {
    const appUrl = new URL(process.env.APP_URL || "");
    assert(appUrl.protocol === "https:", "APP_URL must use https.");
    const allowedHosts = String(process.env.ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase());
    assert(allowedHosts.includes(appUrl.hostname), "ALLOWED_HOSTS must include the APP_URL host.");
  } catch {
    assert(false, "APP_URL must be a valid HTTPS URL.");
  }

  assert(
    Boolean(process.env.CONTACT_WEBHOOK_URL) && !hasPlaceholder(process.env.CONTACT_WEBHOOK_URL),
    "Configure at least one contact/automation webhook for lead delivery.",
  );
  for (const key of [
    "SUPABASE_URL",
    "CONTACT_WEBHOOK_URL",
    "INVITATION_WEBHOOK_URL",
    "AUTH_MFA_WEBHOOK_URL",
  ]) {
    if (!process.env[key]) continue;
    try {
      assert(new URL(process.env[key]).protocol === "https:", `${key} must use https.`);
    } catch {
      assert(false, `${key} must be a valid HTTPS URL.`);
    }
  }
}

function validateBuildArtifacts() {
  const home = path.join(root, "dist", "apps", "web", "pages", "home", "index.html");
  const robots = path.join(root, "dist", "robots.txt");
  const sitemap = path.join(root, "dist", "sitemap.xml");
  assert(fs.existsSync(home), "Production build is missing. Run npm run build before deploy.");
  assert(fs.existsSync(robots), "dist/robots.txt is missing. Run npm run build.");
  assert(fs.existsSync(sitemap), "dist/sitemap.xml is missing. Run npm run build.");
}

async function validateRemoteHealth() {
  if (!checkRemote) return;

  const healthUrl = new URL("/api/health?details=1", process.env.APP_URL).toString();
  try {
    const response = await fetch(healthUrl, {
      headers: { Authorization: `Bearer ${process.env.HEALTHCHECK_TOKEN}` },
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => null);
    assert(response.ok, "Remote authenticated health must return 200.");
    assert(
      body?.readiness?.criticalReady === true,
      "Remote /api/health must report criticalReady=true.",
    );
    assert(
      body?.storage?.mode === "supabase",
      "Remote /api/health must report storage.mode=supabase.",
    );
  } catch {
    fail("Remote authenticated health could not be validated.");
  }
}

if (!loadEnvFile()) process.exit(1);
validateEnv();
validateBuildArtifacts();

const readiness = buildReadiness();
const failedCritical = readiness.checks.filter(
  (check) => check.severity === "critical" && !check.done,
);
failedCritical.forEach((check) => fail(`${check.label}: ${check.description}`));

try {
  const connection = await testStorageConnection();
  assert(connection?.ok === true, "Supabase storage connection must be available.");
} catch {
  fail("Supabase storage connection failed. Inspect protected service logs for details.");
}

await validateRemoteHealth();

if (!process.exitCode) {
  console.info("[production-preflight] Ready for lead-gen production launch.");
  console.info(
    JSON.stringify(
      {
        appUrl: process.env.APP_URL,
        storage: readiness.storage.mode,
        environmentFile: path.basename(envPath),
        publicBillingEnabled: readiness.billing.publicBillingEnabled,
        criticalReady: readiness.criticalReady,
      },
      null,
      2,
    ),
  );
}
