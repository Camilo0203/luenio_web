// Covers api/services/lead-import-service.js, extracted from
// lead-processing-service.js: per-row isolation and the empty/oversized
// rows guards. process.env must be set BEFORE any project module is
// imported (db/storage.js resolves LUENIO_LOCAL_DB_PATH once, at module load).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "test-results", `.lead-import-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify({ businesses: [{ id: "imp_ws" }], leads: [] }));

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { importCrmLeadsFromRows } = await import("../api/services/lead-import-service.js");
const { PipelineStageValidationError } = await import("../api/services/lead-validation-service.js");

try {
  const user = { id: "u1", businessId: "imp_ws", plan: "starter" };

  await assert.rejects(
    () => importCrmLeadsFromRows({ body: { rows: [] }, user }),
    PipelineStageValidationError,
    "An empty rows array must be rejected up front.",
  );
  await assert.rejects(
    () => importCrmLeadsFromRows({ body: {}, user }),
    PipelineStageValidationError,
    "A missing rows field must be rejected the same as an empty array.",
  );

  {
    const result = await importCrmLeadsFromRows({
      body: {
        rows: [
          {
            name: "Ana Pérez",
            business: "Nova Studio",
            phone: "+573001112233",
            service: "CRM",
          },
          { name: "Missing Fields Row" },
          {
            name: "Carlos Ruiz",
            business: "LegalHub",
            phone: "+573102223344",
            service: "Automatización",
          },
        ],
      },
      user,
    });

    assert.equal(result.response.mode, "import");
    assert.equal(result.response.imported, 2, "Two valid rows must import.");
    assert.equal(
      result.response.failed,
      1,
      "One incomplete row must fail without blocking the others.",
    );
    assert.equal(result.response.results.length, 3, "One result per input row, in order.");
    assert.equal(result.response.results[0].ok, true);
    assert.ok(result.response.results[0].leadId);
    assert.equal(result.response.results[1].ok, false);
    assert.equal(result.response.results[1].error, "validation");
    assert.ok(
      Array.isArray(result.response.results[1].missingFields),
      "A validation failure must report which fields were missing.",
    );
    assert.equal(result.response.results[2].ok, true);
  }

  {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      name: `Row ${index}`,
      business: "Bulk Co",
      phone: `+5730000${String(index).padStart(5, "0")}`,
      service: "CRM",
    }));
    const result = await importCrmLeadsFromRows({ body: { rows }, user });
    assert.equal(result.response.results.length, 100, "Import must cap at 100 rows per request.");
  }

  console.info("Lead import service guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
