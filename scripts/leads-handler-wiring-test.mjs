// Confirms api/leads.js is fully decoupled from lead-processing-service.js
// (Step 8 of the lead-intake refactor) and that the error classes it now
// imports directly from lead-validation-service.js are still the exact
// classes thrown by the relocated capture/import services -- an import-path
// change is only safe if `instanceof` still matches.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const leadsHandlerSource = fs.readFileSync(path.join(process.cwd(), "api", "leads.js"), "utf8");
assert(
  !leadsHandlerSource.includes("lead-processing-service"),
  "api/leads.js must not reference lead-processing-service.js at all after this extraction.",
);
assert(leadsHandlerSource.includes("lead-capture-service"));
assert(leadsHandlerSource.includes("lead-import-service"));
assert(leadsHandlerSource.includes("lead-workspace-service"));
assert(leadsHandlerSource.includes("lead-validation-service"));

const fixtureDir = path.join(process.cwd(), "test-results", `.leads-wiring-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");
fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify({ businesses: [{ id: "wire_ws" }], leads: [] }));

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

// The exact same import api/leads.js uses post-decoupling.
const { LeadValidationError, PipelineStageValidationError } =
  await import("../api/services/lead-validation-service.js");
const { captureCrmLeadFromBody } = await import("../api/services/lead-capture-service.js");
const { importCrmLeadsFromRows } = await import("../api/services/lead-import-service.js");
const { listCrmWorkspace } = await import("../api/services/lead-workspace-service.js");

try {
  const user = { id: "u1", businessId: "wire_ws", plan: "starter" };

  await assert.rejects(
    () => captureCrmLeadFromBody({ body: {}, user }),
    (error) => error instanceof LeadValidationError,
    "The error api/leads.js's `error instanceof LeadValidationError` branch must catch is the same class captureCrmLeadFromBody actually throws.",
  );

  await assert.rejects(
    () => importCrmLeadsFromRows({ body: { rows: [] }, user }),
    (error) => error instanceof PipelineStageValidationError,
    "The error api/leads.js's `error instanceof PipelineStageValidationError` branch must catch is the same class importCrmLeadsFromRows actually throws.",
  );

  const workspace = await listCrmWorkspace(user, {});
  assert.equal(
    workspace.ok,
    true,
    "listCrmWorkspace must remain callable from its new canonical path.",
  );

  console.info("api/leads.js wiring guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
