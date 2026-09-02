// Covers api/services/lead-request-router.js (Step 9: relocated from
// lead-processing-service.js verbatim, same exported names). Exercises all
// five processCrmRequestBody modes -- digest, bulk, import, update, and the
// default "process" path -- plus the two error-identity checks
// api/process.js relies on. process.env must be set BEFORE any project
// module is imported (db/storage.js resolves LUENIO_LOCAL_DB_PATH once, at
// module load).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "test-results", `.lead-router-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(
  fixturePath,
  JSON.stringify({
    businesses: [{ id: "router_ws" }],
    leads: [
      {
        id: "existing_lead",
        userId: "router_ws",
        name: "Existing Lead",
        status: "new",
        pipelineStage: "new",
        classification: "hot",
        nextActionAt: "2020-01-01T00:00:00.000Z",
        tags: [],
      },
    ],
  }),
);

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { processCrmRequestBody, LeadValidationError, PipelineStageValidationError } = await import(
  "../api/services/lead-request-router.js"
);

try {
  const user = { id: "u1", businessId: "router_ws", plan: "starter" };

  // --- digest mode ---
  {
    const result = await processCrmRequestBody({ body: { mode: "digest" }, user });
    assert.equal(result.response.ok, true);
    assert.equal(result.response.mode, "digest");
    assert.ok(result.response.digest, "digest mode must return a digest payload.");
    assert.equal(result.response.digest.totals.leads, 1, "digest must be scoped to the caller's workspace.");
  }

  // --- import mode ---
  {
    const result = await processCrmRequestBody({
      body: {
        mode: "import",
        rows: [{ name: "Imported", business: "Biz", phone: "+573001110000", service: "CRM" }],
      },
      user,
    });
    assert.equal(result.response.mode, "import");
    assert.equal(result.response.imported, 1);
  }

  // --- bulk mode ---
  {
    const result = await processCrmRequestBody({
      body: { mode: "bulk", leadIds: ["existing_lead"], status: "qualified" },
      user,
    });
    assert.equal(result.response.mode, "bulk_update");
    assert.equal(result.response.updated, 1);
  }

  // --- update mode (isLeadUpdateRequest) ---
  {
    const result = await processCrmRequestBody({
      body: { leadId: "existing_lead", status: "contacted" },
      user,
    });
    assert.equal(result.response.mode, "pipeline_update");
    assert.equal(result.response.lead.status, "contacted");
  }

  // --- update mode: lead not found -> 404 ---
  await assert.rejects(
    () => processCrmRequestBody({ body: { leadId: "does_not_exist", status: "contacted" }, user }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, "Lead not found in this workspace.");
      return true;
    },
    "An update for a nonexistent lead must surface a 404, matching the pre-router behavior.",
  );

  // --- update mode: invalid pipeline stage -> PipelineStageValidationError ---
  await assert.rejects(
    () => processCrmRequestBody({ body: { leadId: "existing_lead", status: "not_a_stage" }, user }),
    PipelineStageValidationError,
    "api/process.js's `error instanceof PipelineStageValidationError` branch depends on this.",
  );

  // --- default "process" mode ---
  {
    const result = await processCrmRequestBody({
      body: {
        name: "Carlos Ruiz",
        business: "LegalHub",
        phone: "+573102223344",
        service: "Automatización",
      },
      user,
    });
    assert.equal(result.response.ok, true);
    assert.equal(result.response.mode, "processed", "The default path must use the 'processed' response shape, distinct from capture's shape.");
    assert.ok(result.response.lead, "processed mode must echo the normalized lead.");
    assert.ok(result.response.action, "processed mode must include the automation action log.");
  }

  // --- default "process" mode: validation error -> LeadValidationError ---
  await assert.rejects(
    () => processCrmRequestBody({ body: { name: "Missing Everything Else" }, user }),
    LeadValidationError,
    "api/process.js's `error instanceof LeadValidationError` branch depends on this.",
  );

  console.info("Lead request router guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
