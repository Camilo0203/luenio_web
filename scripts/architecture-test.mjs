import fs from "node:fs";
import path from "node:path";
import { SECTORS, demoPath, nichePath } from "../config/sectors.js";
import { canonicalPublicPaths, getDemoPagePath, getNichePagePath } from "../lib/public-routes.js";
import { expandIncludes, hasIncludeDirectives } from "../lib/html-includes.js";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function listFiles(directory) {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(relativePath);
    return relativePath;
  });
}

["apps/web", "apps/admin", "api", "core", "db", "config", "scripts", "public"].forEach(
  (directory) => {
    assert(
      fs.existsSync(path.join(root, directory)),
      `Missing required architecture directory: ${directory}`,
    );
  },
);

assert(!fs.existsSync(path.join(root, "src")), "Legacy root src directory must not exist.");
assert(!fs.existsSync(path.join(root, "api", "_lib")), "Legacy api/_lib directory must not exist.");
assert(
  !fs.existsSync(path.join(root, "api", "leads-db.json")),
  "Legacy api/leads-db.json must not exist.",
);
assert(
  fs.existsSync(path.join(root, "db", "leads-db.example.json")),
  "Versionable local database example must exist at db/leads-db.example.json.",
);

const serverSource = readText("server.js");
const sentryServerSource = readText("lib/sentry.js");
const sentryBrowserSource = readText("apps/admin/crm/sentry-client.js");
assert(
  sentryBrowserSource.includes('import("@sentry/browser")') &&
    !sentryBrowserSource.includes("browser.sentry-cdn.com"),
  "Browser Sentry must load on demand from the pinned package instead of a runtime CDN.",
);
assert(
  sentryServerSource.includes("sendDefaultPii: false") &&
    sentryBrowserSource.includes("sendDefaultPii: false") &&
    sentryServerSource.includes("stripSensitiveServerData") &&
    sentryBrowserSource.includes("stripSensitiveBrowserData"),
  "Sentry must strip PII in both server and browser runtimes.",
);
assert(
  !serverSource.includes("browser.sentry-cdn.com"),
  "CSP must not allow the retired Sentry CDN.",
);
assert(
  serverSource.indexOf("assertSecureProductionRuntime();") <
    serverSource.indexOf('await import("./lib/sentry.js")'),
  "Production security validation must run before loading Sentry and the API graph.",
);
assert(
  getDemoPagePath("/demos") === "index.html",
  "The public demo catalog must support the /demos route.",
);
assert(
  !/getDemoPagePath\(pathname\) \{/.test(serverSource),
  "Public routes must be derived from config/sectors.js, not restated in server.js.",
);
SECTORS.forEach((sector) => {
  assert(getNichePagePath(nichePath(sector)), `Missing route for ${nichePath(sector)}.`);
  assert(getDemoPagePath(demoPath(sector)), `Missing route for ${demoPath(sector)}.`);
});

// The sitemap is the one public artefact the sector table cannot generate, so it
// is checked against the table instead of being kept in step by hand.
const sitemapUrls = [...readText("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => new URL(match[1]).pathname.replace(/(.)\/$/, "$1"),
);
assert(
  sitemapUrls.join(" ") === canonicalPublicPaths().join(" "),
  `public/sitemap.xml must list exactly the canonical public paths.
  sitemap: ${sitemapUrls.join(" ")}
  table:   ${canonicalPublicPaths().join(" ")}`,
);

// Shared chrome lives in apps/web/partials and reaches pages through an include
// directive. Every page that uses one must expand, and the public pages must end
// up with the header, footer and legal bar they declare.
const partialsDir = path.join(root, "apps", "web", "partials");
const pageFiles = listFiles("apps/web/pages").filter((filePath) => filePath.endsWith(".html"));
let expandedPages = 0;
for (const filePath of pageFiles) {
  const source = readText(filePath);
  if (!hasIncludeDirectives(source)) continue;
  const rendered = expandIncludes(source, { partialsDir, sourceLabel: filePath });
  assert(
    !hasIncludeDirectives(rendered),
    `${filePath} still contains an include directive after expansion.`,
  );
  if (source.includes("include: site-header")) {
    assert(
      rendered.includes('class="site-header') && rendered.includes("site-header__inner"),
      `${filePath} must render the shared header.`,
    );
    assert(
      rendered.includes("site-footer__inner") && /class="footer-group"/.test(rendered),
      `${filePath} must render the shared footer with its link groups.`,
    );
  }
  expandedPages += 1;
}
assert(expandedPages === 21, `Expected 21 pages to use the shared chrome, found ${expandedPages}.`);
const productCss = readText("apps/web/src/style.css");
assert(
  /\.brand\s*\{[\s\S]*?border:\s*0;/.test(productCss),
  "Private product branding must not render a square border around the supplied logo.",
);
assert(
  /\.brand-logo\s*\{[\s\S]*?opacity:\s*1;/.test(productCss) &&
    productCss.includes(".brand.logo-error .brand-fallback"),
  "The supplied logo must be visible by default with an explicit load-error fallback.",
);
const adminCss = readText("apps/admin/src/admin.css");
assert(
  adminCss.includes('"brand heading heading user"') &&
    adminCss.includes('"status status actions actions"') &&
    adminCss.includes(".admin-header-actions"),
  "The dashboard header must use a bounded tablet layout.",
);
assert(
  /@media \(max-width: 1050px\)[\s\S]*?\.lead-table-row\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/.test(
    adminCss,
  ),
  "Dashboard lead rows must reflow before tablet widths overflow.",
);
[
  "./api/auth.js",
  "./api/billing.js",
  "./api/contact.js",
  "./api/health.js",
  "./api/leads.js",
  "./api/process.js",
  "./api/settings.js",
  "./api/stripe-webhook.js",
].forEach((handlerImport) => {
  assert(
    !serverSource.includes(handlerImport),
    `server.js must route APIs through api/router.js, not import ${handlerImport} directly.`,
  );
});
assert(
  serverSource.includes("./api/router.js"),
  "server.js must delegate API dispatch to api/router.js.",
);
assert(
  serverSource.includes("sec-fetch-site"),
  "server.js must enforce Fetch Metadata checks on browser mutations.",
);
assert(
  serverSource.includes("Cross-site request blocked."),
  "server.js must explicitly reject cross-site browser mutations.",
);

const runtimeFiles = [
  ...listFiles("api"),
  ...listFiles("config"),
  ...listFiles("core"),
  ...listFiles("db"),
  "server.js",
].filter((filePath) => filePath.endsWith(".js"));
for (const filePath of runtimeFiles) {
  if (filePath === "config\\env.js" || filePath === "config/env.js" || filePath === "server.js")
    continue;
  const source = readText(filePath);
  assert(
    !source.includes("process.env"),
    `${filePath} must read runtime configuration through config/env.js.`,
  );
}

const coreFiles = listFiles("core").filter((filePath) => filePath.endsWith(".js"));
for (const filePath of coreFiles) {
  const source = readText(filePath);
  assert(!source.includes("fetch("), `${filePath} must not perform network I/O.`);
  assert(
    !source.includes("process.env"),
    `${filePath} must not read runtime environment variables.`,
  );
  assert(!source.includes("../config/"), `${filePath} must not import runtime config modules.`);
  assert(!source.includes("../api/"), `${filePath} must not import backend API modules.`);
  assert(!source.includes("../db/"), `${filePath} must not import persistence modules.`);
  assert(
    !source.includes("../apps/") && !source.includes("../../apps/"),
    `${filePath} must not import frontend application modules.`,
  );
  assert(
    !source.includes("Math.random"),
    `${filePath} must use secure record id generation instead of Math.random.`,
  );
}

const dbFiles = listFiles("db").filter((filePath) => filePath.endsWith(".js"));
const allowedDbEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REQUIRE_SUPABASE"];
const domainEventTypes = [
  "message.received",
  "intent.classified",
  "crm.updated",
  "followup.triggered",
  "automation.triggered",
  "lead.created",
  "pipeline.updated",
  "subscription.updated",
];
for (const filePath of dbFiles) {
  const source = readText(filePath);
  assert(
    !source.includes("api/leads-db.json"),
    `${filePath} must not read legacy api/leads-db.json.`,
  );
  assert(
    !source.includes("api\\\\leads-db.json"),
    `${filePath} must not read legacy api/leads-db.json.`,
  );
  const envMatches = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]);
  envMatches.forEach((envVar) => {
    assert(
      allowedDbEnvVars.includes(envVar),
      `${filePath} must not read ${envVar}; keep non-storage runtime config in api/services or config.`,
    );
  });
  domainEventTypes.forEach((eventType) => {
    assert(
      !source.includes(`type: "${eventType}"`),
      `${filePath} must not construct ${eventType}; keep domain events in core.`,
    );
  });
  assert(
    !source.includes("createDomainEvent"),
    `${filePath} must persist domain events, not construct them.`,
  );
  assert(
    !source.includes("buildPipelineUpdatedEvent"),
    `${filePath} must persist prebuilt pipeline events, not construct them.`,
  );
  assert(
    !source.includes("buildSubscriptionUpdatedEvent"),
    `${filePath} must persist prebuilt subscription events, not construct them.`,
  );
  assert(
    !source.includes("buildLeadLifecycleEvents"),
    `${filePath} must persist prebuilt CRM lifecycle events, not construct them.`,
  );
  assert(
    !source.includes("buildLeadNotification"),
    `${filePath} must persist prebuilt CRM notifications, not construct them.`,
  );
  assert(
    !source.includes("Math.random"),
    `${filePath} must use shared secure record id generation instead of Math.random.`,
  );
  assert(
    !source.includes("../core/ids.js"),
    `${filePath} must not create domain record ids inside persistence.`,
  );
}

const apiFiles = listFiles("api").filter((filePath) => filePath.endsWith(".js"));
for (const filePath of apiFiles) {
  const source = readText(filePath);
  assert(!source.includes("./_lib/"), `${filePath} must not import legacy api/_lib modules.`);
  assert(!source.includes("../api/_lib/"), `${filePath} must not import legacy api/_lib modules.`);
}

const authServiceSource = readText("api/services/auth-service.js");
assert(
  authServiceSource.includes("../../core/ids.js"),
  "Auth service must use the shared record id generator.",
);
assert(
  !authServiceSource.includes("function createId"),
  "Auth service must not keep a parallel user id generator.",
);
const invitationServiceSource = readText("api/services/invitation-service.js");
const passwordResetServiceSource = readText("api/services/password-reset-service.js");
assert(
  invitationServiceSource.includes("/aceptar-invitacion#token=") &&
    passwordResetServiceSource.includes("/restablecer-acceso#token=") &&
    !invitationServiceSource.includes("?token=") &&
    !passwordResetServiceSource.includes("?token="),
  "One-time access tokens must remain in URL fragments and out of HTTP logs.",
);
const sessionTokenSource =
  authServiceSource.match(
    /export async function createSessionToken[\s\S]*?export async function verifySessionToken/,
  )?.[0] || "";
assert(sessionTokenSource.includes("tokenHash"), "Sessions must persist only a bearer-token hash.");
assert(
  sessionTokenSource.includes("randomBytes(32)"),
  "Session bearer secrets must contain at least 256 bits of randomness.",
);
assert(
  !sessionTokenSource.includes("user.email") && !sessionTokenSource.includes("user.businessName"),
  "Opaque session tokens must not include user PII.",
);
[
  "MAX_PASSWORD_HASH_CONCURRENCY",
  "MAX_PASSWORD_HASH_QUEUE",
  "acquirePasswordHashSlot",
  "Authentication service is temporarily busy.",
].forEach((passwordBoundary) => {
  assert(
    authServiceSource.includes(passwordBoundary),
    `Password hashing must enforce ${passwordBoundary}.`,
  );
});

const publicContactSource = readText("api/contact.js");
assert(
  publicContactSource.includes("capturePublicInquiryFromBody"),
  "api/contact.js must delegate public inquiry capture to contact-service.",
);
[
  "../core/engine.js",
  "generateRecordId",
  "normalizeTextField",
  "leadFieldLimits",
  "function normalizeInquiry",
  "function validateInquiry",
  "function sanitizeWebhookResult",
].forEach((forbiddenContactHandlerDependency) => {
  assert(
    !publicContactSource.includes(forbiddenContactHandlerDependency),
    `api/contact.js must not inline ${forbiddenContactHandlerDependency}; keep public contact use cases in contact-service.`,
  );
});
[
  "name: stored.inquiry.name",
  "business: stored.inquiry.business",
  "phone: stored.inquiry.phone",
  "service: stored.inquiry.service",
  "message: stored.inquiry.message",
].forEach((forbiddenLogPattern) => {
  assert(
    !publicContactSource.includes(forbiddenLogPattern),
    `Public contact logs must not include customer PII via ${forbiddenLogPattern}.`,
  );
});

[
  "api/auth.js",
  "api/billing.js",
  "api/contact.js",
  "api/health.js",
  "api/leads.js",
  "api/process.js",
  "api/settings.js",
  "api/stripe-webhook.js",
].forEach((filePath) => {
  const source = readText(filePath);
  assert(
    !source.includes("error: error.message"),
    `${filePath} must not expose raw runtime errors in API responses.`,
  );
});

const apiHandlerFiles = fs
  .readdirSync(path.join(root, "api"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => path.join("api", entry.name));
for (const filePath of apiHandlerFiles) {
  const source = readText(filePath);
  assert(
    !source.includes("fetch("),
    `${filePath} must not perform network I/O directly; use api/services instead.`,
  );
}

const leadsHandlerSource = readText("api/leads.js");
assert(
  leadsHandlerSource.includes("listCrmWorkspace"),
  "api/leads.js must delegate CRM listing to lead-processing-service.",
);
assert(
  leadsHandlerSource.includes("captureCrmLeadFromBody"),
  "api/leads.js must delegate lead capture to lead-processing-service.",
);
const processHandlerSource = readText("api/process.js");
assert(
  processHandlerSource.includes("processCrmRequestBody"),
  "api/process.js must delegate pipeline and lead processing to lead-processing-service.",
);
[
  ["api/leads.js", leadsHandlerSource],
  ["api/process.js", processHandlerSource],
].forEach(([filePath, source]) => {
  [
    "../core/engine.js",
    "../core/events.js",
    "../db/storage.js",
    "normalizeLead",
    "validateLead",
    "isValidPipelineStage",
    "buildPipelineUpdatedEvent",
    "updateLeadPipeline",
    "listCrmData",
    "getStorageMode",
    "assertLeadLimit",
    "buildAutomationDeliveryPlan",
    "deliverQueuedAutomationActions",
    "buildCrmRecordBundle",
    "storeCrmRecord",
    "getLeadUsage",
  ].forEach((forbiddenHandlerDependency) => {
    assert(
      !source.includes(forbiddenHandlerDependency),
      `${filePath} must not inline ${forbiddenHandlerDependency}; keep CRM use cases in lead-processing-service.`,
    );
  });
});

const billingHandlerSource = readText("api/billing.js");
assert(
  billingHandlerSource.includes("getBillingOverview"),
  "api/billing.js must delegate billing overview to billing-service.",
);
assert(
  billingHandlerSource.includes("createBillingCheckout"),
  "api/billing.js must delegate checkout creation to billing-service.",
);
[
  "../config/billing.js",
  "../db/storage.js",
  "getLeadUsage",
  "plans",
  "listCrmData",
  "createStripeCheckout",
].forEach((forbiddenBillingHandlerDependency) => {
  assert(
    !billingHandlerSource.includes(forbiddenBillingHandlerDependency),
    `api/billing.js must not inline ${forbiddenBillingHandlerDependency}; keep billing use cases in billing-service.`,
  );
});

const settingsHandlerSource = readText("api/settings.js");
assert(
  settingsHandlerSource.includes("getWorkspaceSettings"),
  "api/settings.js must delegate workspace settings to settings-service.",
);
[
  "../config/billing.js",
  "../config/readiness.js",
  "function buildChecklist",
  "buildReadiness",
  "getPlan",
].forEach((forbiddenSettingsHandlerDependency) => {
  assert(
    !settingsHandlerSource.includes(forbiddenSettingsHandlerDependency),
    `api/settings.js must not inline ${forbiddenSettingsHandlerDependency}; keep workspace settings in settings-service.`,
  );
});

const healthHandlerSource = readText("api/health.js");
assert(
  healthHandlerSource.includes("getPublicHealth"),
  "api/health.js must delegate public health assembly to health-service.",
);
[
  "../config/readiness.js",
  "../db/storage.js",
  "buildPublicReadiness",
  "buildReadiness",
  "getStorageHealth",
  "testStorageConnection",
  "publicStorageHealth",
].forEach((forbiddenHealthHandlerDependency) => {
  assert(
    !healthHandlerSource.includes(forbiddenHealthHandlerDependency),
    `api/health.js must not inline ${forbiddenHealthHandlerDependency}; keep public health assembly in health-service.`,
  );
});

const authHandlerSource = readText("api/auth.js");
assert(
  authHandlerSource.includes("Public registration is disabled"),
  "api/auth.js must explicitly reject public registration.",
);
assert(
  !authHandlerSource.includes("registerAuthSession"),
  "api/auth.js must not expose the retired public registration flow.",
);
assert(
  authHandlerSource.includes("loginAuthSession"),
  "api/auth.js must delegate login flow to auth-flow-service.",
);
assert(
  authHandlerSource.includes("getAuthSession"),
  "api/auth.js must delegate session lookup to auth-flow-service.",
);
[
  "createUser",
  "authenticateUser",
  "createSessionToken",
  "getSessionUser",
  "../db/storage.js",
  "getStorageMode",
].forEach((forbiddenAuthHandlerDependency) => {
  assert(
    !authHandlerSource.includes(forbiddenAuthHandlerDependency),
    `api/auth.js must not inline ${forbiddenAuthHandlerDependency}; keep auth flow in auth-flow-service.`,
  );
});

const stripeWebhookHandlerSource = readText("api/stripe-webhook.js");
assert(
  stripeWebhookHandlerSource.includes("processStripeWebhook"),
  "api/stripe-webhook.js must delegate Stripe webhook processing to stripe-webhook-service.",
);
[
  "node:crypto",
  "../config/billing.js",
  "../config/env.js",
  "../core/events.js",
  "../db/storage.js",
  "verifyStripeSignature",
  "buildSubscriptionUpdate",
  "handleCheckoutSession",
  "handleSubscriptionObject",
  "updateUserSubscription",
].forEach((forbiddenStripeWebhookHandlerDependency) => {
  assert(
    !stripeWebhookHandlerSource.includes(forbiddenStripeWebhookHandlerDependency),
    `api/stripe-webhook.js must not inline ${forbiddenStripeWebhookHandlerDependency}; keep Stripe webhook use cases in stripe-webhook-service.`,
  );
});

const frontendFiles = [...listFiles("apps/web/src"), ...listFiles("apps/admin/src")].filter(
  (filePath) => filePath.endsWith(".js"),
);
for (const filePath of frontendFiles) {
  if (filePath.endsWith("api-client.js")) continue;
  const source = readText(filePath);
  assert(
    !source.includes("fetch("),
    `${filePath} must call the local api-client instead of fetch directly.`,
  );
}

const publicWebSource = readText("apps/web/src/public-site.js");
["luenio.public.leads", "luenio.recent.leads", "storeLeadRequest", "isDuplicateLead"].forEach(
  (forbiddenPublicStoragePattern) => {
    assert(
      !publicWebSource.includes(forbiddenPublicStoragePattern),
      `Public landing must not persist lead PII via ${forbiddenPublicStoragePattern}.`,
    );
  },
);
[
  "business: lead.business",
  "phone: lead.phone",
  "message: lead.message",
  "message: error.message",
].forEach((forbiddenTrackingPattern) => {
  assert(
    !publicWebSource.includes(forbiddenTrackingPattern),
    `Public landing analytics must not store ${forbiddenTrackingPattern}.`,
  );
});
const buildLeadPayloadSource =
  publicWebSource.match(/function buildLeadPayload[\s\S]*?function validateLead/)?.[0] || "";
["id:", "timestamp:"].forEach((forbiddenClientAuthorityPattern) => {
  assert(
    !buildLeadPayloadSource.includes(forbiddenClientAuthorityPattern),
    `Public landing lead payload must not create server-owned field ${forbiddenClientAuthorityPattern}.`,
  );
});

const adminDashboardSource = listFiles("apps/admin/src")
  .filter((filePath) => filePath.endsWith(".js"))
  .map((filePath) => readText(filePath))
  .join("\n");
const adminFormatSource = readText("apps/admin/src/format.js");
const adminEntrySource = readText("apps/admin/src/admin.js");
assert(
  adminFormatSource.includes("export function escapeHtml") &&
    adminEntrySource.includes('from "./format.js"') &&
    adminDashboardSource.includes("safeText"),
  "Admin dashboard must define an HTML escaping boundary for API-rendered data.",
);
assert(
  adminEntrySource.includes('from "./state.js"') &&
    adminEntrySource.includes('from "./lead-model.js"') &&
    adminEntrySource.includes('from "./demo/live-demo.js"'),
  "Admin entry must wire modular state, lead-model, and live-demo modules.",
);
[
  "${state.user.email}",
  "${state.user.businessName",
  "${lead.name}",
  "${lead.business}",
  "${lead.phone}",
  "${lead.service}",
  "${lead.source",
  "${lead.workflow",
  "${lead.scoreReasons",
  "${plan.name}",
  "${item.label}",
  "${item.description}",
  "${restrictedActions.join",
  "${error.message}",
].forEach((unsafeInterpolation) => {
  assert(
    !adminDashboardSource.includes(unsafeInterpolation),
    `Admin dashboard must not render unescaped CRM data via ${unsafeInterpolation}.`,
  );
});
assert(
  adminDashboardSource.includes("safeText(error.message)"),
  "Admin dashboard error rendering must escape runtime messages.",
);
assert(
  !adminDashboardSource.includes('style="'),
  "Admin dashboard must not render inline style attributes; keep CSP strict.",
);

[
  "rejectUntrustedProxy",
  "rejectUnknownHost",
  "X-Request-ID",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Refusing insecure production startup",
  "server.maxConnections",
].forEach((securityBoundary) => {
  assert(serverSource.includes(securityBoundary), `Server must enforce ${securityBoundary}.`);
});

const composeSource = readText("docker-compose.yml");
const edgeComposeSource = readText("ops/edge-compose.yml");
[
  "read_only: true",
  "no-new-privileges:true",
  "cap_drop:",
  "pids_limit:",
  "mem_limit:",
  "app_internal",
  "automation_internal",
].forEach((containerBoundary) => {
  assert(
    composeSource.includes(containerBoundary),
    `Docker Compose must enforce ${containerBoundary}.`,
  );
});
assert(
  edgeComposeSource.includes("caddy:2.11.4-alpine") &&
    edgeComposeSource.includes("read_only: true") &&
    edgeComposeSource.includes("no-new-privileges:true"),
  "The shared Caddy edge must use the pinned hardened container.",
);
assert(!composeSource.includes(":latest"), "Production containers must not use latest tags.");

const dockerfileSource = readText("Dockerfile");
assert(
  (dockerfileSource.match(/node:22\.23\.1-alpine3\.24/g) || []).length === 2,
  "Builder and runtime Node images must be pinned to the reviewed LTS patch.",
);
assert(dockerfileSource.includes("USER node"), "Runtime container must run as a non-root user.");

const caddySource = readText("Caddyfile");
[
  "trusted_proxies static",
  "trusted_proxies_strict",
  "CF-Connecting-IP",
  "X-Luenio-Proxy-Secret",
  "X-Real-IP {client_ip}",
  "Strict-Transport-Security",
  "X-Permitted-Cross-Domain-Policies",
].forEach((proxyBoundary) => {
  assert(caddySource.includes(proxyBoundary), `Caddy must enforce ${proxyBoundary}.`);
});
assert(
  caddySource.includes("@editor not path /webhook/*") &&
    !caddySource.includes("@editor not path /webhook/* /webhook-test/*"),
  "n8n test webhooks must stay behind editor authentication.",
);
assert(caddySource.includes("basic_auth @editor"), "The n8n editor must require authentication.");
assert(
  caddySource.includes('?Referrer-Policy "strict-origin-when-cross-origin"'),
  "Caddy must preserve stricter no-referrer headers on one-time token pages.",
);

const securityMaintenanceSource = readText("ops/security-maintenance.sh");
assert(
  securityMaintenanceSource.includes("https://*") &&
    securityMaintenanceSource.includes("luenio_security_maintenance") &&
    securityMaintenanceSource.includes("umask 077"),
  "Security maintenance must require HTTPS and protect the service-role credential.",
);
const securityMaintenanceUnit = readText("ops/systemd/luenio-security-maintenance.service");
[
  "DynamicUser=true",
  "NoNewPrivileges=true",
  "ProtectSystem=strict",
  "CapabilityBoundingSet=",
].forEach((boundary) => {
  assert(
    securityMaintenanceUnit.includes(boundary),
    `Security maintenance service must enforce ${boundary}.`,
  );
});

const backupSource = readText("ops/backup-volumes.sh");
assert(
  backupSource.includes('"${production_compose[@]}" stop n8n') &&
    backupSource.includes('"${staging_compose[@]}" stop n8n') &&
    !backupSource.includes("stop caddy"),
  "Backups must keep the public Caddy edge online.",
);
assert(
  backupSource.includes("node:22.23.1-alpine3.24") && !backupSource.includes(" alpine "),
  "Backup helpers must use a reviewed versioned image.",
);
const healthMonitorSource = readText("ops/monitor-health.sh");
assert(
  healthMonitorSource.includes('"deliveryQueue":{"healthy":true'),
  "Protected monitoring must detect a degraded contact delivery queue.",
);

const settingsServiceSource = readText("api/services/settings-service.js");
assert(
  !settingsServiceSource.includes("buildReadiness") &&
    !settingsServiceSource.includes("getStorageHealth"),
  "Client settings must not expose deployment or storage topology.",
);

const contactServiceSource = readText("api/services/contact-service.js");
assert(
  contactServiceSource.includes("CONTACT_WEBHOOK_TIMEOUT_MS = 12_000"),
  "Initial contact delivery must have a short bounded timeout.",
);
const publicContactResponseSource =
  contactServiceSource.match(/function buildPublicInquiryResponse[\s\S]*?\n}/)?.[0] || "";
assert(
  !publicContactResponseSource.includes("storage") &&
    !publicContactResponseSource.includes("webhook"),
  "Public contact responses must not expose storage or webhook internals.",
);

console.info("Architecture boundaries passed");
