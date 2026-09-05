// Covers api/services/lead-update-service.js, extracted from
// lead-processing-service.js: normalizeLeadUpdates() (pure) plus
// applyLeadUpdate()/bulkUpdateLeads() (storage-backed, via a local JSON DB
// fixture -- process.env must be set before any project module is imported,
// db/storage.js resolves its local DB path from LUENIO_LOCAL_DB_PATH once,
// at module load).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "test-results", `.lead-update-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(
  fixturePath,
  JSON.stringify({
    businesses: [{ id: "upd_ws" }],
    leads: [
      { id: "lead_a", userId: "upd_ws", name: "A", status: "new", pipelineStage: "new", tags: [] },
      {
        id: "lead_b",
        userId: "upd_ws",
        name: "B",
        status: "new",
        pipelineStage: "new",
        tags: ["vip"],
      },
    ],
  }),
);

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { normalizeLeadUpdates, applyLeadUpdate, bulkUpdateLeads } =
  await import("../api/services/lead-update-service.js");
const { PipelineStageValidationError } = await import("../api/services/lead-validation-service.js");

try {
  // --- normalizeLeadUpdates: pure normalization/validation, no storage ---

  {
    const updates = normalizeLeadUpdates({ status: "qualified" }, {});
    assert.deepEqual(updates, { status: "qualified", pipelineStage: "qualified" });
  }

  assert.throws(
    () => normalizeLeadUpdates({ status: "not_a_real_stage" }, {}),
    PipelineStageValidationError,
    "An invalid pipeline stage must be rejected.",
  );

  assert.throws(
    () => normalizeLeadUpdates({}, {}),
    (error) => {
      assert.ok(error instanceof PipelineStageValidationError);
      assert.equal(error.message, "No valid lead updates provided.");
      return true;
    },
  );

  assert.deepEqual(
    normalizeLeadUpdates({ assigneeUserId: "" }, {}),
    { assigneeUserId: null },
    "An empty-string assignee must clear the assignment.",
  );
  assert.deepEqual(normalizeLeadUpdates({ assigneeUserId: "user_42" }, {}), {
    assigneeUserId: "user_42",
  });

  assert.throws(
    () => normalizeLeadUpdates({ contactLogEntry: { summary: "" } }, {}),
    (error) => {
      assert.ok(error instanceof PipelineStageValidationError);
      assert.equal(error.message, "Contact log summary is required.");
      return true;
    },
    "An empty contact log summary must be rejected, not silently dropped.",
  );

  {
    const updates = normalizeLeadUpdates(
      { contactLogEntry: { summary: "Llamó y quedó de responder mañana" } },
      { contactLog: [] },
    );
    assert.equal(updates.contactLog.length, 1);
    assert.equal(updates.contactLog[0].summary, "Llamó y quedó de responder mañana");
    assert.ok(updates.lastContactedAt, "A logged contact must set lastContactedAt.");
  }

  // --- applyLeadUpdate: storage-backed, shared by bulk and single-update paths ---

  {
    const { pipelineOnly, result } = await applyLeadUpdate({
      leadId: "lead_a",
      tenantId: "upd_ws",
      patch: { status: "qualified", actorUserId: "u1" },
      existingLead: { id: "lead_a", userId: "upd_ws", tags: [] },
    });
    assert.equal(pipelineOnly, true, "A status-only patch must be classified pipeline-only.");
    assert.equal(result.lead.status, "qualified");
    assert.equal(result.lead.pipelineStage, "qualified", "Persisted lead must reflect the update.");
  }

  {
    const { pipelineOnly } = await applyLeadUpdate({
      leadId: "lead_b",
      tenantId: "upd_ws",
      patch: { notes: "Interesado en plan Pro", actorUserId: "u1" },
      existingLead: { id: "lead_b", userId: "upd_ws", tags: ["vip"] },
    });
    assert.equal(pipelineOnly, false, "A non-pipeline field must not be classified pipeline-only.");
  }

  await assert.rejects(
    () =>
      applyLeadUpdate({
        leadId: "lead_a",
        tenantId: "upd_ws",
        patch: {},
        existingLead: { id: "lead_a", userId: "upd_ws" },
      }),
    PipelineStageValidationError,
    "applyLeadUpdate must propagate validation errors, not swallow them (matches the pre-extraction single-update path).",
  );

  // --- bulkUpdateLeads: per-item isolation, storage-backed ---

  {
    const user = { id: "u1", businessId: "upd_ws" };
    const result = await bulkUpdateLeads({
      body: { leadIds: ["lead_a", "lead_b", "missing_lead"], status: "contacted" },
      user,
    });
    assert.equal(result.response.mode, "bulk_update");
    assert.equal(result.response.updated, 2);
    assert.equal(result.response.failed, 1);
    const byId = Object.fromEntries(result.response.results.map((row) => [row.leadId, row]));
    assert.equal(byId.lead_a.ok, true);
    assert.equal(byId.lead_b.ok, true);
    assert.equal(byId.missing_lead.ok, false);
    assert.equal(byId.missing_lead.error, "not_found");
  }

  {
    const user = { id: "u1", businessId: "upd_ws" };
    const result = await bulkUpdateLeads({ body: { leadIds: ["lead_a"] }, user });
    assert.equal(
      result.response.results[0].error,
      "no_updates",
      "A patch with no status/tags/assignee must be reported as no_updates, not silently skipped.",
    );
  }

  await assert.rejects(
    () => bulkUpdateLeads({ body: { leadIds: [] }, user: { id: "u1", businessId: "upd_ws" } }),
    PipelineStageValidationError,
    "An empty leadIds array must be rejected up front.",
  );

  console.info("Lead update service guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
