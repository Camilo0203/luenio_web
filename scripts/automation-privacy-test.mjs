// Covers the persist-then-deliver automation flow end to end: processCrmLead
// (lead-capture-service.js) must persist the lead + queued deliveries first,
// then attempt immediate delivery via automation-delivery-service.js -- and
// the response's integrationResults must stay privacy-safe (no destination
// URLs, no raw provider errors), exactly as before this change.
//
// process.env must be set BEFORE any project module is imported: db/storage.js
// resolves its local DB path from LUENIO_LOCAL_DB_PATH once, at module load.
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(
  process.cwd(),
  "test-results",
  `.automation-privacy-fixture-${process.pid}`,
);
const fixturePath = path.join(fixtureDir, "leads-db.json");
fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify({ businesses: [{ id: "priv_ws" }], leads: [] }));

const envKeys = [
  "NODE_ENV",
  "LUENIO_LOCAL_DB_PATH",
  "LUENIO_WEBHOOK_URL",
  "LUENIO_CRM_WEBHOOK_URL",
  "LUENIO_WHATSAPP_WEBHOOK_URL",
  "LUENIO_EMAIL_WEBHOOK_URL",
  "AUTOMATION_WEBHOOK_TOKEN",
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;

process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;
process.env.LUENIO_WEBHOOK_URL = "https://internal.example/webhook/main";
process.env.LUENIO_CRM_WEBHOOK_URL = "https://internal.example/webhook/crm";
process.env.LUENIO_WHATSAPP_WEBHOOK_URL = "https://internal.example/webhook/whatsapp";
process.env.LUENIO_EMAIL_WEBHOOK_URL = "https://internal.example/webhook/email";
process.env.AUTOMATION_WEBHOOK_TOKEN = "automation-test-token";

const { normalizeLead } = await import("../core/engine.js");
const { processCrmLead } = await import("../api/services/lead-capture-service.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const deliveredUrls = [];
  const deliveredAuthorizations = [];
  globalThis.fetch = async (url, options) => {
    deliveredUrls.push(url);
    deliveredAuthorizations.push(options?.headers?.Authorization);
    return {
      ok: false,
      status: 502,
    };
  };

  const lead = normalizeLead({
    name: "Automation Privacy",
    business: "Automation Privacy Business",
    phone: "+573001112233",
    service: "Automatización de WhatsApp",
    message: "Quiero automatizar mis ventas, necesito cotizacion y precio para empezar ahora.",
    source: "automation_privacy_test",
  });
  const user = { id: "u1", businessId: "priv_ws", plan: "pro" };

  const { actionLog } = await processCrmLead({ lead, user });

  assert(
    deliveredUrls.includes(process.env.LUENIO_WEBHOOK_URL),
    "Configured webhook must be invoked by the immediate delivery attempt after persist.",
  );
  assert(
    deliveredAuthorizations.every((value) => value === "Bearer automation-test-token"),
    "Every automation delivery must use its configured bearer token.",
  );
  assert(
    deliveredUrls.includes(process.env.LUENIO_CRM_WEBHOOK_URL),
    "Configured CRM webhook must be invoked by the immediate delivery attempt.",
  );
  assert(
    actionLog.integrationResults.length >= 2,
    "Automation should record integration delivery results.",
  );

  actionLog.integrationResults.forEach((result) => {
    assert(result.label, "Integration result must include a label.");
    assert(result.status, "Integration result must include status.");
    assert(
      !("destination" in result),
      "Integration result must not expose internal destination URLs.",
    );
    assert(!("error" in result), "Integration result must not expose raw provider errors.");
    assert(!("payload" in result), "Integration result must not expose the raw outbound payload.");
  });

  // Every configured action failed (mock fetch returns 502) -> each queued
  // delivery must survive as a retryable row (with backoff applied, so it's
  // correctly NOT claimable yet), not be dropped -- the safety net this
  // whole refactor exists for.
  const fixtureAfter = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const retriedRows = (fixtureAfter.automationDeliveries || []).filter(
    (row) => row.leadId === lead.id,
  );
  assert(
    retriedRows.length >= 2,
    "A failed immediate delivery attempt must leave a retryable row behind for the worker, not disappear.",
  );
  assert(
    retriedRows.every((row) => row.status === "retry"),
    "Rows for a failed immediate attempt must be in 'retry' status, not 'dead' or silently dropped.",
  );
  assert(
    retriedRows.every((row) => new Date(row.nextAttemptAt).getTime() > Date.now()),
    "A retry must have backoff applied (next_attempt_at in the future), proving it won't be claimed again immediately.",
  );

  console.info("Automation privacy guard passed");
} finally {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
  globalThis.fetch = previousFetch;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
