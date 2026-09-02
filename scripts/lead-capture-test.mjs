// Covers api/services/lead-capture-service.js, extracted from the original
// lead-processing-service.js (since split further into lead-request-router.js),
// and confirms captureCrmLeadFromBody's error identity matches what
// api/process.js's `instanceof` checks rely on (via lead-request-router.js's
// re-export of lead-validation-service.js's classes).
//
// process.env must be set BEFORE any project module is imported: db/storage.js
// resolves its local DB path from LUENIO_LOCAL_DB_PATH once, at module load.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "test-results", `.lead-capture-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify({ businesses: [{ id: "cap_ws" }], leads: [] }));

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { normalizeLeadInput, processCrmLead, captureCrmLeadFromBody } = await import(
  "../api/services/lead-capture-service.js"
);
const { LeadValidationError: ValidationErrorFromValidationService } = await import(
  "../api/services/lead-validation-service.js"
);
// The exact same import api/process.js uses for its `instanceof` check.
const { LeadValidationError: ValidationErrorAsImportedByProcessHandler } = await import(
  "../api/services/lead-request-router.js"
);

try {
  // --- normalizeLeadInput: normalize (trim/limit) then validate, composed ---

  {
    const lead = normalizeLeadInput({
      name: "  Ana  ",
      business: "Nova Studio",
      phone: "+573001112233",
      service: "CRM",
    });
    assert.equal(lead.name, "Ana", "Whitespace must be trimmed before validation.");
    assert.equal(lead.business, "Nova Studio");
  }

  assert.throws(
    () => normalizeLeadInput({ name: "   ", business: "Nova", phone: "+573001112233", service: "CRM" }),
    (error) => {
      assert.ok(error instanceof ValidationErrorFromValidationService);
      assert.deepEqual(error.missingFields, ["name"], "A whitespace-only field must count as missing.");
      return true;
    },
    "Normalization must run before validation, so a whitespace-only name is caught.",
  );

  // --- Cross-module identity: the exact concern behind the lead-request-router.js migration ---
  assert.equal(
    ValidationErrorFromValidationService,
    ValidationErrorAsImportedByProcessHandler,
    "lead-request-router.js's re-export must be the same class object as the source module " +
      "(ES module re-exports are references, not copies) -- otherwise api/process.js's " +
      "`error instanceof LeadValidationError` check would silently stop matching.",
  );

  // --- captureCrmLeadFromBody: full pipeline through the relocated module ---

  const user = { id: "u1", businessId: "cap_ws", plan: "starter" };

  await assert.rejects(
    () => captureCrmLeadFromBody({ body: { name: "Solo Name" }, user }),
    (error) => {
      assert.ok(error instanceof ValidationErrorAsImportedByProcessHandler);
      assert.deepEqual([...error.missingFields].sort(), ["business", "phone", "service"]);
      return true;
    },
    "captureCrmLeadFromBody must still reject an incomplete lead exactly as before the extraction.",
  );

  const captured = await captureCrmLeadFromBody({
    body: {
      name: "Ana Pérez",
      business: "Nova Studio",
      phone: "+573001112233",
      service: "Automatización de WhatsApp",
      message: "Quiero cotización y precio para empezar ahora",
      source: "landing",
    },
    user,
  });

  assert.equal(captured.response.ok, true);
  assert.ok(captured.response.leadId, "Response must carry the generated lead id.");
  assert.equal(captured.response.userId, "u1");
  assert.ok(Array.isArray(captured.response.integrations), "Automation results must be surfaced.");
  assert.equal(captured.log.leadId, captured.response.leadId, "Stored log must match the response.");

  // processCrmLead directly (used by both capture and the /api/process fallback)
  const secondLead = normalizeLeadInput({
    name: "Carlos Ruiz",
    business: "LegalHub",
    phone: "+573102223344",
    service: "Automatización",
  });
  const processed = await processCrmLead({ lead: secondLead, user });
  assert.ok(processed.stored, "processCrmLead must persist and return the stored record.");
  assert.ok(processed.usage, "processCrmLead must return current plan usage.");

  console.info("Lead capture service guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
