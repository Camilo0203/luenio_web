import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4180";
const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const shouldRestoreLocalDb = process.env.E2E_RESTORE_LOCAL_DB !== "false";
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;
let cookie = "";

process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_luenio_local_test_secret";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoStore(response, label) {
  assert(response.headers.get("cache-control") === "no-store", `${label} must not be cached.`);
  assert(
    response.headers.get("pragma") === "no-cache",
    `${label} must include legacy no-cache pragma.`,
  );
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, body };
}

async function unauthenticatedRequest(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, body };
}

function stripeSignature(rawBody, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function seedStarterLimitLeads(userId, existingLeadId) {
  if (!fs.existsSync(localDbPath)) return;
  const database = JSON.parse(fs.readFileSync(localDbPath, "utf8"));
  const timestamp = new Date().toISOString();
  const seededLeads = Array.from({ length: 99 }, (_, index) => ({
    id: `seed_limit_${Date.now()}_${index}`,
    userId,
    name: `Seed Lead ${index + 1}`,
    business: "Limit Test Business",
    phone: `+57300999${String(index).padStart(4, "0")}`,
    service: "Automatización de WhatsApp",
    message: "Seeded lead for monthly limit enforcement.",
    source: "e2e_limit_seed",
    score: 60,
    classification: "warm",
    status: "qualified",
    pipelineStage: "qualified",
    scoreReasons: ["e2e_limit_seed"],
    timestamp,
    updatedAt: timestamp,
  }));

  const leads = [
    ...(database.leads || []).filter((lead) => lead.id === existingLeadId),
    ...seededLeads,
    ...(database.leads || []).filter((lead) => lead.userId !== userId),
  ];

  fs.writeFileSync(
    localDbPath,
    JSON.stringify({ ...database, leads, updatedAt: timestamp }, null, 2),
  );
}

try {
  const landing = await unauthenticatedRequest("/");
  assert(landing.response.ok, "Landing route must load from /.");
  assert(landing.body.includes("Luenio Agency"), "Landing route must render the public SaaS page.");

  const legacyFolderRoute = await unauthenticatedRequest("/Pagina%20Luenio");
  assert(legacyFolderRoute.response.ok, "Legacy /Pagina Luenio route must not return Cannot GET.");
  assert(
    legacyFolderRoute.body.includes("Luenio Agency"),
    "Legacy folder route must render the public SaaS page.",
  );

  const health = await request("/api/health");
  assert(health.response.ok, `Health check failed: ${JSON.stringify(health.body)}`);
  assertNoStore(health.response, "Health API response");
  assert(health.body.storage?.mode, "Health response must include storage mode.");
  assert(
    Array.isArray(health.body.readiness?.checks),
    "Health response must include production readiness checks.",
  );
  assert(
    typeof health.body.readiness?.criticalReady === "boolean",
    "Readiness must expose criticalReady boolean.",
  );
  assert(
    !health.body.storage.missing,
    "Public health must not expose detailed missing environment variables.",
  );
  assert(
    !health.body.readiness.security,
    "Public health must not expose security configuration details.",
  );
  assert(
    !health.body.readiness.billing,
    "Public health must not expose billing configuration details.",
  );
  assert(!health.body.readiness.deployment, "Public health must not expose deployment internals.");

  const unknownApi = await unauthenticatedRequest("/api/not-a-real-route");
  assert(unknownApi.response.status === 404, "Unknown API routes must return 404.");
  assertNoStore(unknownApi.response, "Unknown API response");
  assert(
    unknownApi.body.error === "API route not found.",
    "Unknown API routes must return a JSON error.",
  );

  const invalidJson = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{invalid-json",
  });
  assert(invalidJson.response.status === 400, "Invalid JSON request bodies must return 400.");
  assertNoStore(invalidJson.response, "Invalid JSON API response");
  assert(invalidJson.body.error === "Invalid JSON body.", "Invalid JSON errors must be explicit.");

  const unsupportedMediaType = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "not-json",
  });
  assert(
    unsupportedMediaType.response.status === 415,
    "Mutable API routes must require application/json.",
  );
  assertNoStore(unsupportedMediaType.response, "Unsupported media type API response");
  assert(
    unsupportedMediaType.body.error === "Unsupported media type. Use application/json.",
    "Unsupported media type errors must be explicit.",
  );

  const oversizedBody = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      name: "Oversized Lead",
      business: "Oversized Business",
      phone: "+573009998899",
      service: "Automatización de WhatsApp",
      message: "x".repeat(1_000_050),
      source: "payload_limit_test",
    }),
  });
  assert(oversizedBody.response.status === 413, "Oversized request bodies must return 413.");
  assert(
    oversizedBody.body.error === "Request body too large.",
    "Oversized body errors must be explicit.",
  );

  const publicInquiry = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      id: "client_public_inquiry_id",
      name: "Public Lead",
      business: "Public Business",
      phone: "+573009998877",
      service: "Automatización de WhatsApp",
      message: "Quiero automatizar respuestas y seguimiento.",
      source: "landing",
      timestamp: "1999-01-01T00:00:00.000Z",
    }),
  });
  assert(
    publicInquiry.response.ok,
    `Public contact capture failed: ${JSON.stringify(publicInquiry.body)}`,
  );
  assert(publicInquiry.body.inquiryId, "Public contact capture must return inquiry id.");
  assert(
    publicInquiry.body.inquiryId !== "client_public_inquiry_id",
    "Public contact capture must generate server-owned inquiry ids.",
  );
  assert(
    publicInquiry.body.inquiryId.startsWith("inquiry_"),
    "Public inquiry ids must use the inquiry prefix.",
  );
  assert(
    publicInquiry.body.webhook?.status === "not_configured",
    "Public contact capture must report webhook delivery status.",
  );
  assert(
    !("destination" in (publicInquiry.body.webhook || {})),
    "Public contact response must not expose webhook destination URLs.",
  );
  assert(
    !("error" in (publicInquiry.body.webhook || {})),
    "Public contact response must not expose internal webhook errors.",
  );

  const duplicatePublicInquiry = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      name: "Public Lead Again",
      business: "Public Business",
      phone: "+57 300 999 8877",
      service: "Automatización de WhatsApp",
      message: "Duplicate public request.",
      source: "landing",
    }),
  });
  assert(
    duplicatePublicInquiry.response.status === 409,
    "Recent duplicate public inquiries must be rejected.",
  );

  const blockedCrossOrigin = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://evil.example",
    },
    body: JSON.stringify({
      name: "Cross Origin",
      business: "Blocked Business",
      phone: "+573009998800",
      service: "Automatización de WhatsApp",
      message: "This should be blocked.",
      source: "csrf_test",
    }),
  });
  assert(
    blockedCrossOrigin.response.status === 403,
    "Cross-origin mutable API requests must be blocked.",
  );

  const blockedCrossSiteFetch = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Sec-Fetch-Site": "cross-site",
    },
    body: JSON.stringify({
      name: "Cross Site",
      business: "Blocked Fetch Metadata",
      phone: "+573009998802",
      service: "Automatización de WhatsApp",
      message: "This browser cross-site mutation should be blocked.",
      source: "fetch_metadata_csrf_test",
    }),
  });
  assert(
    blockedCrossSiteFetch.response.status === 403,
    "Browser cross-site mutable API requests must be blocked with Fetch Metadata.",
  );
  assert(
    blockedCrossSiteFetch.body.error === "Cross-site request blocked.",
    "Fetch Metadata block must return an explicit error.",
  );

  const allowedSameOrigin = await unauthenticatedRequest("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: baseUrl,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({
      name: "Same Origin",
      business: "Allowed Business",
      phone: "+573009998801",
      service: "Automatización de WhatsApp",
      message: "This same-origin public request should pass.",
      source: "same_origin_test",
    }),
  });
  assert(
    allowedSameOrigin.response.ok,
    `Same-origin mutable API request should pass: ${JSON.stringify(allowedSameOrigin.body)}`,
  );

  const authPage = await unauthenticatedRequest("/auth.html");
  assert(authPage.response.ok, "Auth page must load for unauthenticated users.");
  assert(
    authPage.body.includes("Accede a tu CRM de automatización."),
    "Auth page must render UTF-8 copy correctly.",
  );
  assert(authPage.body.includes("auth-trust"), "Auth page must render workspace trust signals.");
  assert(
    authPage.response.headers.get("x-frame-options") === "DENY",
    "Auth page must deny framing.",
  );
  assert(
    authPage.response.headers.get("x-content-type-options") === "nosniff",
    "Auth page must set nosniff.",
  );
  assert(
    authPage.response.headers.get("cache-control") === "no-store",
    "Auth page must not be cached.",
  );

  const loginPage = await unauthenticatedRequest("/login");
  assert(loginPage.response.ok, "Clean /login route must load for unauthenticated users.");
  assert(
    loginPage.body.includes("Accede a tu CRM de automatización."),
    "Login route must render the auth page.",
  );
  assert(
    loginPage.response.headers.get("cache-control") === "no-store",
    "Login route must not be cached.",
  );

  const protectedAdmin = await unauthenticatedRequest("/admin.html", { redirect: "manual" });
  assert(protectedAdmin.response.status === 302, "Admin HTML must redirect when unauthenticated.");
  assert(
    protectedAdmin.response.headers.get("location") === "/login",
    "Unauthenticated admin redirect must target /login.",
  );
  assert(
    protectedAdmin.response.headers.get("cache-control") === "no-store",
    "Protected admin redirect must not be cached.",
  );

  const protectedDashboard = await unauthenticatedRequest("/dashboard", { redirect: "manual" });
  assert(
    protectedDashboard.response.status === 302,
    "Dashboard route must redirect when unauthenticated.",
  );
  assert(
    protectedDashboard.response.headers.get("location") === "/login",
    "Unauthenticated dashboard redirect must target /login.",
  );

  const protectedApis = [
    ["/api/leads", { method: "GET" }],
    ["/api/billing", { method: "GET" }],
    ["/api/settings", { method: "GET" }],
    [
      "/api/process",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    ],
  ];

  for (const [pathname, options] of protectedApis) {
    const protectedApi = await unauthenticatedRequest(pathname, options);
    assert(protectedApi.response.status === 401, `${pathname} must require authentication.`);
    assert(protectedApi.body.error, `${pathname} must return an auth error.`);
  }

  const invalidPlanRegistration = await unauthenticatedRequest("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      email: `spoof-${Date.now()}@luenio.test`,
      password: "super-secret-123",
      businessName: "Plan Spoof Workspace",
      plan: "enterprise_free_forever",
    }),
  });
  assert(
    invalidPlanRegistration.response.status === 400,
    "Registration must reject unknown plans.",
  );
  assert(
    invalidPlanRegistration.body.error === "Unknown plan.",
    "Unknown plan registration must return clear error.",
  );

  const authEmail = `e2e-${Date.now()}@luenio.test`;
  const registered = await request("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      email: authEmail,
      password: "super-secret-123",
      businessName: "Luenio E2E Workspace",
      plan: "starter",
    }),
  });
  assert(registered.response.ok, `Registration failed: ${JSON.stringify(registered.body)}`);
  assertNoStore(registered.response, "Auth registration API response");
  assert(registered.body.user?.id, "Registered user must include id.");
  const sessionCookie = registered.response.headers.get("set-cookie") || "";
  assert(sessionCookie.includes("HttpOnly"), "Session cookie must be HttpOnly.");
  assert(sessionCookie.includes("SameSite=Lax"), "Session cookie must use SameSite=Lax.");
  assert(sessionCookie.includes("Max-Age="), "Session cookie must include Max-Age.");
  const primaryCookie = cookie;

  const session = await request("/api/auth");
  assertNoStore(session.response, "Auth session API response");
  assert(session.body.authenticated === true, "Session must be authenticated after registration.");

  const leadPayload = {
    id: "client_owned_crm_lead_id",
    name: "E2E Lead",
    business: "Luenio Test Business",
    phone: "+573001234567",
    service: "Automatizacion de WhatsApp",
    message: "Quiero automatizar WhatsApp, cotizacion y seguimiento de leads esta semana.",
    source: "hero",
    timestamp: "1999-01-01T00:00:00.000Z",
  };

  const created = await request("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(leadPayload),
  });
  assert(created.response.ok, `Lead creation failed: ${JSON.stringify(created.body)}`);
  assertNoStore(created.response, "Lead creation API response");
  assert(created.body.ok === true, "Lead API must return ok=true.");
  assert(
    created.body.leadId !== "client_owned_crm_lead_id",
    "Lead API must generate server-owned lead ids.",
  );
  assert(created.body.leadId.startsWith("lead_"), "Lead API ids must use the lead prefix.");
  assert(
    created.body.classification === "hot",
    `Expected hot lead, got ${created.body.classification}.`,
  );
  assert(created.body.score >= 80, `Expected score >= 80, got ${created.body.score}.`);
  assert(
    ["contacted", "converted"].includes(created.body.pipelineStage),
    `Unexpected pipeline stage ${created.body.pipelineStage}.`,
  );
  assert(
    created.body.usage?.used === 1,
    `Monthly usage must count the created CRM lead, got ${JSON.stringify(created.body.usage)}.`,
  );
  assert(
    created.body.usage?.remaining === 99,
    "Starter monthly usage must report remaining leads.",
  );
  assert(
    !created.body.actions.includes("send_crm_webhook"),
    "Starter plan must restrict CRM webhook action.",
  );
  assert(
    created.body.restrictedActions.includes("send_crm_webhook"),
    "Restricted CRM webhook action must be reported.",
  );
  assert(
    created.body.actions.includes("create_crm_deal"),
    "Automation must still create CRM deal.",
  );

  const spoofedScoreLead = await request("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      name: "Spoofed Score Lead",
      business: "Untrusted Client Payload",
      phone: "+573001234568",
      service: "Consulta general",
      message: "Solo estoy mirando, tal vez mas adelante.",
      source: "unknown",
      score: 100,
      scoreReasons: ["client_score"],
      classification: "hot",
      status: "converted",
      pipelineStage: "converted",
    }),
  });
  assert(
    spoofedScoreLead.response.ok,
    `Spoofed score lead should still be processed safely: ${JSON.stringify(spoofedScoreLead.body)}`,
  );
  assert(spoofedScoreLead.body.score < 80, "Lead API must ignore client-provided score.");
  assert(
    spoofedScoreLead.body.classification !== "hot",
    "Lead API must ignore client-provided classification.",
  );
  assert(
    spoofedScoreLead.body.pipelineStage !== "converted",
    "Lead API must ignore client-provided initial pipeline stage.",
  );
  assert(
    !spoofedScoreLead.body.scoreReasons.includes("client_score"),
    "Lead API must ignore client-provided score reasons.",
  );
  assert(
    spoofedScoreLead.body.usage?.used === 2,
    "Monthly usage must count safely processed spoofed lead.",
  );

  const duplicateCrmLead = await request("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ...leadPayload,
      name: "E2E Lead Duplicate",
      phone: "+57 300 123 4567",
    }),
  });
  assert(duplicateCrmLead.response.status === 409, "Recent duplicate CRM leads must be rejected.");

  const list = await request("/api/leads");
  assert(list.response.ok, `Lead list failed: ${JSON.stringify(list.body)}`);
  assertNoStore(list.response, "Lead list API response");
  const storedLead = list.body.leads.find((lead) => lead.id === created.body.leadId);
  assert(storedLead, "Created lead must be retrievable from /api/leads.");
  assert(
    storedLead.userId === registered.body.user.id || storedLead.user_id === registered.body.user.id,
    "Lead must persist inside current tenant.",
  );
  assert(storedLead.source === "hero", "Source tracking must persist.");
  assert(storedLead.score === created.body.score, "Score must persist.");
  const storedSpoofedLead = list.body.leads.find(
    (lead) => lead.id === spoofedScoreLead.body.leadId,
  );
  assert(storedSpoofedLead, "Safely processed spoofed lead must still be persisted.");
  assert(
    storedSpoofedLead.score === spoofedScoreLead.body.score,
    "Persisted spoofed lead must use server-computed score.",
  );
  assert(
    storedSpoofedLead.pipelineStage !== "converted" &&
      storedSpoofedLead.pipeline_stage !== "converted",
    "Persisted spoofed lead must use server-computed pipeline stage.",
  );
  assert(
    list.body.events.some((event) => event.type === "lead.created"),
    "Lead creation must record an event.",
  );
  const lifecycleEvents = [
    "message.received",
    "intent.classified",
    "crm.updated",
    "followup.triggered",
    "automation.triggered",
  ];
  lifecycleEvents.forEach((eventType) => {
    assert(
      list.body.events.some((event) => event.type === eventType),
      `Lead lifecycle must record ${eventType}.`,
    );
  });
  const storedAction = list.body.actions.find(
    (action) => action.leadId === created.body.leadId || action.lead_id === created.body.leadId,
  );
  assert(storedAction, "Created lead must persist an automation action log.");
  const integrationResults =
    storedAction.integrationResults || storedAction.integration_results || [];
  integrationResults.forEach((result) => {
    assert(
      !("destination" in result),
      "Persisted automation integration results must not expose destination URLs.",
    );
    assert(
      !("error" in result),
      "Persisted automation integration results must not expose raw provider errors.",
    );
  });
  const restrictedActions = storedAction.restrictedActions || storedAction.restricted_actions || [];
  assert(
    restrictedActions.includes("send_crm_webhook"),
    "Restricted automation actions must persist for upgrade prompts.",
  );

  const secondRegistered = await request("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      email: `tenant-${Date.now()}@luenio.test`,
      password: "tenant-secret-123",
      businessName: "Tenant Isolation Workspace",
      plan: "starter",
    }),
  });
  assert(
    secondRegistered.response.ok,
    `Second tenant registration failed: ${JSON.stringify(secondRegistered.body)}`,
  );

  const secondTenantLeads = await request("/api/leads");
  assert(
    secondTenantLeads.response.ok,
    `Second tenant lead list failed: ${JSON.stringify(secondTenantLeads.body)}`,
  );
  assert(
    !secondTenantLeads.body.leads.some((lead) => lead.id === created.body.leadId),
    "Second tenant must not see first tenant lead.",
  );

  const forbiddenPipelineUpdate = await request("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: created.body.leadId,
      status: "converted",
      pipelineStage: "converted",
    }),
  });
  assert(
    forbiddenPipelineUpdate.response.status === 404,
    "Second tenant must not update first tenant lead.",
  );
  assert(forbiddenPipelineUpdate.body.error, "Cross-tenant pipeline update must return an error.");
  cookie = primaryCookie;

  const invalidPipelineUpdate = await request("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: created.body.leadId,
      status: "lost_forever",
      pipelineStage: "lost_forever",
    }),
  });
  assert(
    invalidPipelineUpdate.response.status === 400,
    "Invalid pipeline stage updates must be rejected.",
  );

  const processed = await request("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: created.body.leadId,
      status: "converted",
      pipelineStage: "converted",
    }),
  });
  assert(processed.response.ok, `Pipeline update failed: ${JSON.stringify(processed.body)}`);

  const afterUpdate = await request("/api/leads");
  const updatedLead = afterUpdate.body.leads.find((lead) => lead.id === created.body.leadId);
  assert(
    updatedLead.status === "converted" || updatedLead.pipeline_stage === "converted",
    "Pipeline status must update to converted.",
  );
  assert(
    afterUpdate.body.events.some((event) => event.type === "pipeline.updated"),
    "Pipeline update must record an event.",
  );

  const admin = await request("/admin.html");
  assert(
    admin.response.ok && admin.body.includes("pipelineBoard"),
    "Admin dashboard must render pipeline board.",
  );
  assert(
    admin.response.headers.get("cache-control") === "no-store",
    "Admin dashboard must not be cached.",
  );
  assert(admin.body.includes("setupChecklist"), "Admin dashboard must render setup checklist.");
  assert(admin.body.includes("liveStatus"), "Admin dashboard must render live sync status.");
  assert(
    admin.body.includes("billingStatus"),
    "Admin dashboard must render billing status feedback.",
  );
  const adminJs = fs.readFileSync(
    path.join(process.cwd(), "apps", "admin", "src", "admin.js"),
    "utf8",
  );
  assert(
    adminJs.includes("loadDashboard({ silent: true, showSkeleton: false })"),
    "Background CRM polling must refresh silently without skeleton flicker.",
  );
  assert(adminJs.includes("state.loadedOnce"), "Admin dashboard must track initial load state.");

  const dashboard = await request("/dashboard");
  assert(
    dashboard.response.ok && dashboard.body.includes("pipelineBoard"),
    "Clean /dashboard route must render pipeline board for authenticated users.",
  );
  assert(
    dashboard.response.headers.get("cache-control") === "no-store",
    "Dashboard route must not be cached.",
  );

  const billing = await request("/api/billing");
  assert(billing.response.ok, `Billing API failed: ${JSON.stringify(billing.body)}`);
  assertNoStore(billing.response, "Billing API response");
  assert(billing.body.plans?.starter?.monthlyLeadLimit, "Billing plans must be available.");
  assert(
    billing.body.usage?.used === 2,
    `Billing usage must be monthly and tenant-scoped, got ${JSON.stringify(billing.body.usage)}.`,
  );
  assert(
    billing.body.usage?.limit === 100,
    "Billing usage must include active plan monthly limit.",
  );

  const invalidCheckoutPlan = await request("/api/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "unknown_enterprise_plan" }),
  });
  assert(
    invalidCheckoutPlan.response.status === 400,
    "Billing checkout must reject unknown plans before Stripe.",
  );
  assert(
    invalidCheckoutPlan.body.error === "Unknown plan.",
    "Unknown billing plans must return a clear error.",
  );

  const normalizedStageLead = await request("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Stage Normalization",
      business: "Pipeline QA",
      phone: "+573001118888",
      service: "Automatización de WhatsApp",
      message: "Quiero automatizar WhatsApp y seguimiento de leads esta semana.",
      source: "demo",
      pipelineStage: "untrusted_stage",
      status: "untrusted_stage",
    }),
  });
  assert(
    normalizedStageLead.response.ok,
    `Lead processing with invalid client stage should normalize: ${JSON.stringify(normalizedStageLead.body)}`,
  );
  assert(
    ["new", "qualified", "contacted", "converted"].includes(
      normalizedStageLead.body.lead.pipelineStage,
    ),
    "Lead processing must normalize invalid pipeline stages.",
  );

  if (health.body.storage.mode === "json_fallback") {
    seedStarterLimitLeads(registered.body.user.id, created.body.leadId);
    const blockedProcessLead = await request("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bypass Attempt",
        business: "Limit Test Business",
        phone: "+573001119999",
        service: "Automatización de WhatsApp",
        message: "Quiero procesar un lead aunque el plan esté al límite.",
        source: "billing_limit_test",
      }),
    });
    assert(
      blockedProcessLead.response.status === 402,
      "Full lead processing must enforce the monthly plan limit.",
    );
    assert(
      blockedProcessLead.body.usage?.used === 100,
      "Blocked process response must include current monthly usage.",
    );
  }

  const settings = await request("/api/settings");
  assert(settings.response.ok, `Settings API failed: ${JSON.stringify(settings.body)}`);
  assert(
    settings.body.checklist?.length >= 2,
    "Settings checklist must include workspace readiness items.",
  );
  assert(
    settings.body.readiness?.checks?.length >= 6,
    "Settings must include production readiness checks.",
  );
  assert(
    settings.body.readiness.checks.some((check) => check.id === "stripe_prices"),
    "Readiness must check Stripe price IDs.",
  );
  assert(
    settings.body.readiness.security,
    "Authenticated settings must include security readiness details.",
  );
  assert(
    settings.body.readiness.billing,
    "Authenticated settings must include billing readiness details.",
  );
  assert(
    settings.body.readiness.deployment,
    "Authenticated settings must include deployment readiness details.",
  );

  const stripeEvent = {
    id: `evt_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${Date.now()}`,
        customer: "cus_e2e",
        subscription: "sub_e2e",
        payment_status: "paid",
        client_reference_id: registered.body.user.id,
        metadata: {
          user_id: registered.body.user.id,
          plan: "pro",
        },
      },
    },
  };
  const rawStripeBody = JSON.stringify(stripeEvent);
  const badStripeWebhook = await request("/api/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "t=123,v1=bad",
    },
    body: rawStripeBody,
  });
  assert(
    badStripeWebhook.response.status === 400,
    "Malformed Stripe signatures must be rejected with 400.",
  );

  const stripeWebhook = await request("/api/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": stripeSignature(rawStripeBody, process.env.STRIPE_WEBHOOK_SECRET),
    },
    body: rawStripeBody,
  });
  assert(stripeWebhook.response.ok, `Stripe webhook failed: ${JSON.stringify(stripeWebhook.body)}`);

  const updatedSession = await request("/api/auth");
  assert(updatedSession.body.user?.plan === "pro", "Stripe webhook must update user plan to pro.");
  const afterBilling = await request("/api/leads");
  assert(
    afterBilling.body.events.some((event) => event.type === "subscription.updated"),
    "Stripe webhook must record subscription event.",
  );

  const logout = await request("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
  assert(logout.response.ok, `Logout failed: ${JSON.stringify(logout.body)}`);
  const clearedCookie = logout.response.headers.get("set-cookie") || "";
  assert(clearedCookie.includes("Max-Age=0"), "Logout must clear the session cookie.");
  assert(clearedCookie.includes("HttpOnly"), "Cleared session cookie must remain HttpOnly.");

  const loggedOutSession = await request("/api/auth");
  assert(
    loggedOutSession.body.authenticated === false,
    "Session must be unauthenticated after logout.",
  );
  const adminAfterLogout = await request("/admin.html", { redirect: "manual" });
  assert(adminAfterLogout.response.status === 302, "Admin must redirect after logout.");

  console.info("Luenio SaaS e2e passed", {
    storage: health.body.storage.mode,
    leadId: created.body.leadId,
    score: created.body.score,
    classification: created.body.classification,
  });
} finally {
  if (shouldRestoreLocalDb && localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (shouldRestoreLocalDb && localDbSnapshot === null && fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
