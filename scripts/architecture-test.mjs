import fs from "node:fs";
import path from "node:path";

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

[
  "apps/web",
  "apps/admin",
  "api",
  "core",
  "db",
  "config",
  "scripts",
  "public",
].forEach((directory) => {
  assert(fs.existsSync(path.join(root, directory)), `Missing required architecture directory: ${directory}`);
});

assert(!fs.existsSync(path.join(root, "src")), "Legacy root src directory must not exist.");
assert(!fs.existsSync(path.join(root, "api", "_lib")), "Legacy api/_lib directory must not exist.");
assert(!fs.existsSync(path.join(root, "api", "leads-db.json")), "Legacy api/leads-db.json must not exist.");
assert(fs.existsSync(path.join(root, "db", "leads-db.example.json")), "Versionable local database example must exist at db/leads-db.example.json.");

const serverSource = readText("server.js");
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
  assert(!serverSource.includes(handlerImport), `server.js must route APIs through api/router.js, not import ${handlerImport} directly.`);
});
assert(serverSource.includes("./api/router.js"), "server.js must delegate API dispatch to api/router.js.");
assert(serverSource.includes("sec-fetch-site"), "server.js must enforce Fetch Metadata checks on browser mutations.");
assert(serverSource.includes("Cross-site request blocked."), "server.js must explicitly reject cross-site browser mutations.");

const runtimeFiles = [
  ...listFiles("api"),
  ...listFiles("config"),
  ...listFiles("core"),
  ...listFiles("db"),
  "server.js",
].filter((filePath) => filePath.endsWith(".js"));
for (const filePath of runtimeFiles) {
  if (filePath === "config\\env.js" || filePath === "config/env.js" || filePath === "server.js") continue;
  const source = readText(filePath);
  assert(!source.includes("process.env"), `${filePath} must read runtime configuration through config/env.js.`);
}

const coreFiles = listFiles("core").filter((filePath) => filePath.endsWith(".js"));
for (const filePath of coreFiles) {
  const source = readText(filePath);
  assert(!source.includes("fetch("), `${filePath} must not perform network I/O.`);
  assert(!source.includes("process.env"), `${filePath} must not read runtime environment variables.`);
  assert(!source.includes("../config/"), `${filePath} must not import runtime config modules.`);
  assert(!source.includes("../api/"), `${filePath} must not import backend API modules.`);
  assert(!source.includes("../db/"), `${filePath} must not import persistence modules.`);
  assert(!source.includes("../apps/") && !source.includes("../../apps/"), `${filePath} must not import frontend application modules.`);
  assert(!source.includes("Math.random"), `${filePath} must use secure record id generation instead of Math.random.`);
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
  assert(!source.includes("api/leads-db.json"), `${filePath} must not read legacy api/leads-db.json.`);
  assert(!source.includes("api\\\\leads-db.json"), `${filePath} must not read legacy api/leads-db.json.`);
  const envMatches = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]);
  envMatches.forEach((envVar) => {
    assert(allowedDbEnvVars.includes(envVar), `${filePath} must not read ${envVar}; keep non-storage runtime config in api/services or config.`);
  });
  domainEventTypes.forEach((eventType) => {
    assert(!source.includes(`type: "${eventType}"`), `${filePath} must not construct ${eventType}; keep domain events in core.`);
  });
  assert(!source.includes("createDomainEvent"), `${filePath} must persist domain events, not construct them.`);
  assert(!source.includes("buildPipelineUpdatedEvent"), `${filePath} must persist prebuilt pipeline events, not construct them.`);
  assert(!source.includes("buildSubscriptionUpdatedEvent"), `${filePath} must persist prebuilt subscription events, not construct them.`);
  assert(!source.includes("buildLeadLifecycleEvents"), `${filePath} must persist prebuilt CRM lifecycle events, not construct them.`);
  assert(!source.includes("buildLeadNotification"), `${filePath} must persist prebuilt CRM notifications, not construct them.`);
  assert(!source.includes("Math.random"), `${filePath} must use shared secure record id generation instead of Math.random.`);
  assert(!source.includes("../core/ids.js"), `${filePath} must not create domain record ids inside persistence.`);
}

const apiFiles = listFiles("api").filter((filePath) => filePath.endsWith(".js"));
for (const filePath of apiFiles) {
  const source = readText(filePath);
  assert(!source.includes("./_lib/"), `${filePath} must not import legacy api/_lib modules.`);
  assert(!source.includes("../api/_lib/"), `${filePath} must not import legacy api/_lib modules.`);
}

const authServiceSource = readText("api/services/auth-service.js");
assert(authServiceSource.includes("../../core/ids.js"), "Auth service must use the shared record id generator.");
assert(!authServiceSource.includes("function createId"), "Auth service must not keep a parallel user id generator.");
const sessionTokenSource = authServiceSource.match(/export function createSessionToken[\s\S]*?export function verifySessionToken/)?.[0] || "";
[
  "email:",
  "businessName:",
  "plan:",
].forEach((forbiddenSessionPayloadField) => {
  assert(!sessionTokenSource.includes(forbiddenSessionPayloadField), `Session token payload must not include ${forbiddenSessionPayloadField}`);
});

const publicContactSource = readText("api/contact.js");
assert(publicContactSource.includes("capturePublicInquiryFromBody"), "api/contact.js must delegate public inquiry capture to contact-service.");
[
  "../core/engine.js",
  "generateRecordId",
  "normalizeTextField",
  "leadFieldLimits",
  "function normalizeInquiry",
  "function validateInquiry",
  "function sanitizeWebhookResult",
].forEach((forbiddenContactHandlerDependency) => {
  assert(!publicContactSource.includes(forbiddenContactHandlerDependency), `api/contact.js must not inline ${forbiddenContactHandlerDependency}; keep public contact use cases in contact-service.`);
});
[
  "name: stored.inquiry.name",
  "business: stored.inquiry.business",
  "phone: stored.inquiry.phone",
  "service: stored.inquiry.service",
  "message: stored.inquiry.message",
].forEach((forbiddenLogPattern) => {
  assert(!publicContactSource.includes(forbiddenLogPattern), `Public contact logs must not include customer PII via ${forbiddenLogPattern}.`);
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
  assert(!source.includes("error: error.message"), `${filePath} must not expose raw runtime errors in API responses.`);
});

const apiHandlerFiles = fs.readdirSync(path.join(root, "api"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => path.join("api", entry.name));
for (const filePath of apiHandlerFiles) {
  const source = readText(filePath);
  assert(!source.includes("fetch("), `${filePath} must not perform network I/O directly; use api/services instead.`);
}

const leadsHandlerSource = readText("api/leads.js");
assert(leadsHandlerSource.includes("listCrmWorkspace"), "api/leads.js must delegate CRM listing to lead-processing-service.");
assert(leadsHandlerSource.includes("captureCrmLeadFromBody"), "api/leads.js must delegate lead capture to lead-processing-service.");
const processHandlerSource = readText("api/process.js");
assert(processHandlerSource.includes("processCrmRequestBody"), "api/process.js must delegate pipeline and lead processing to lead-processing-service.");
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
    "runAutomationEngine",
    "buildCrmRecordBundle",
    "storeCrmRecord",
    "getLeadUsage",
  ].forEach((forbiddenHandlerDependency) => {
    assert(!source.includes(forbiddenHandlerDependency), `${filePath} must not inline ${forbiddenHandlerDependency}; keep CRM use cases in lead-processing-service.`);
  });
});

const billingHandlerSource = readText("api/billing.js");
assert(billingHandlerSource.includes("getBillingOverview"), "api/billing.js must delegate billing overview to billing-service.");
assert(billingHandlerSource.includes("createBillingCheckout"), "api/billing.js must delegate checkout creation to billing-service.");
[
  "../config/billing.js",
  "../db/storage.js",
  "getLeadUsage",
  "plans",
  "listCrmData",
  "createStripeCheckout",
].forEach((forbiddenBillingHandlerDependency) => {
  assert(!billingHandlerSource.includes(forbiddenBillingHandlerDependency), `api/billing.js must not inline ${forbiddenBillingHandlerDependency}; keep billing use cases in billing-service.`);
});

const settingsHandlerSource = readText("api/settings.js");
assert(settingsHandlerSource.includes("getWorkspaceSettings"), "api/settings.js must delegate workspace settings to settings-service.");
[
  "../config/billing.js",
  "../config/readiness.js",
  "function buildChecklist",
  "buildReadiness",
  "getPlan",
].forEach((forbiddenSettingsHandlerDependency) => {
  assert(!settingsHandlerSource.includes(forbiddenSettingsHandlerDependency), `api/settings.js must not inline ${forbiddenSettingsHandlerDependency}; keep workspace settings in settings-service.`);
});

const healthHandlerSource = readText("api/health.js");
assert(healthHandlerSource.includes("getPublicHealth"), "api/health.js must delegate public health assembly to health-service.");
[
  "../config/readiness.js",
  "../db/storage.js",
  "buildPublicReadiness",
  "buildReadiness",
  "getStorageHealth",
  "testStorageConnection",
  "publicStorageHealth",
].forEach((forbiddenHealthHandlerDependency) => {
  assert(!healthHandlerSource.includes(forbiddenHealthHandlerDependency), `api/health.js must not inline ${forbiddenHealthHandlerDependency}; keep public health assembly in health-service.`);
});

const authHandlerSource = readText("api/auth.js");
assert(authHandlerSource.includes("registerAuthSession"), "api/auth.js must delegate registration flow to auth-flow-service.");
assert(authHandlerSource.includes("loginAuthSession"), "api/auth.js must delegate login flow to auth-flow-service.");
assert(authHandlerSource.includes("getAuthSession"), "api/auth.js must delegate session lookup to auth-flow-service.");
[
  "createUser",
  "authenticateUser",
  "createSessionToken",
  "getSessionUser",
  "../db/storage.js",
  "getStorageMode",
].forEach((forbiddenAuthHandlerDependency) => {
  assert(!authHandlerSource.includes(forbiddenAuthHandlerDependency), `api/auth.js must not inline ${forbiddenAuthHandlerDependency}; keep auth flow in auth-flow-service.`);
});

const stripeWebhookHandlerSource = readText("api/stripe-webhook.js");
assert(stripeWebhookHandlerSource.includes("processStripeWebhook"), "api/stripe-webhook.js must delegate Stripe webhook processing to stripe-webhook-service.");
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
  assert(!stripeWebhookHandlerSource.includes(forbiddenStripeWebhookHandlerDependency), `api/stripe-webhook.js must not inline ${forbiddenStripeWebhookHandlerDependency}; keep Stripe webhook use cases in stripe-webhook-service.`);
});

const frontendFiles = [
  ...listFiles("apps/web/src"),
  ...listFiles("apps/admin/src"),
].filter((filePath) => filePath.endsWith(".js"));
for (const filePath of frontendFiles) {
  if (filePath.endsWith("api-client.js")) continue;
  const source = readText(filePath);
  assert(!source.includes("fetch("), `${filePath} must call the local api-client instead of fetch directly.`);
}

const publicWebSource = readText("apps/web/src/main.js");
[
  "luenio.public.leads",
  "luenio.recent.leads",
  "storeLeadRequest",
  "isDuplicateLead",
].forEach((forbiddenPublicStoragePattern) => {
  assert(!publicWebSource.includes(forbiddenPublicStoragePattern), `Public landing must not persist lead PII via ${forbiddenPublicStoragePattern}.`);
});
[
  "business: lead.business",
  "phone: lead.phone",
  "message: lead.message",
  "message: error.message",
].forEach((forbiddenTrackingPattern) => {
  assert(!publicWebSource.includes(forbiddenTrackingPattern), `Public landing analytics must not store ${forbiddenTrackingPattern}.`);
});
const buildLeadPayloadSource = publicWebSource.match(/function buildLeadPayload[\s\S]*?function validateLead/)?.[0] || "";
[
  "id:",
  "timestamp:",
].forEach((forbiddenClientAuthorityPattern) => {
  assert(!buildLeadPayloadSource.includes(forbiddenClientAuthorityPattern), `Public landing lead payload must not create server-owned field ${forbiddenClientAuthorityPattern}.`);
});

const adminDashboardSource = readText("apps/admin/src/admin.js");
assert(adminDashboardSource.includes("function escapeHtml"), "Admin dashboard must define an HTML escaping boundary for API-rendered data.");
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
  assert(!adminDashboardSource.includes(unsafeInterpolation), `Admin dashboard must not render unescaped CRM data via ${unsafeInterpolation}.`);
});
assert(adminDashboardSource.includes("safeText(error.message)"), "Admin dashboard error rendering must escape runtime messages.");
assert(!adminDashboardSource.includes("style=\""), "Admin dashboard must not render inline style attributes; keep CSP strict.");

console.info("Architecture boundaries passed");
