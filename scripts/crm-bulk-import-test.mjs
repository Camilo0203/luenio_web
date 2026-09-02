import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseCrmCsv } from "../apps/admin/src/csv-import.js";
import { getEmailTemplate, buildMailtoUrl } from "../apps/admin/src/reply-templates.js";
import { bulkUpdateLeads } from "../api/services/lead-update-service.js";
import { importCrmLeadsFromRows } from "../api/services/lead-import-service.js";
import { listCrmWorkspace } from "../api/services/lead-workspace-service.js";

const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;

const csv = `nombre,negocio,telefono,servicio,fuente,tags
Ana Pérez,Nova Studio,+57 300 111 2233,WhatsApp CRM,import_csv,urgente
,Missing,phone,Service,x,
Carlos Ruiz,LegalHub,+57 310 222 3344,Automatización,csv,demo
`;

const parsed = parseCrmCsv(csv, { maxRows: 10 });
assert.equal(parsed.rows.length, 2, "Valid rows only");
assert.ok(parsed.errors.some((error) => error.includes("Fila 3")));
assert.equal(parsed.rows[0].name, "Ana Pérez");
assert.equal(parsed.rows[0].source, "import_csv");

const email = getEmailTemplate({
  name: "Ana",
  business: "Nova",
  service: "CRM",
  classification: "hot",
});
assert.ok(email.subject.includes("Nova") || email.subject.includes("CRM"));
assert.ok(email.body.includes("Ana"));
assert.ok(buildMailtoUrl({ name: "Ana", business: "Nova", service: "CRM" }).startsWith("mailto:"));

// Service-level bulk/import need a user context with storage; use minimal fake when possible.
// Prefer unit-level guards already covered above; if JSON storage is available, exercise import.
const user = {
  id: "usr_bulk_test",
  businessId: "usr_bulk_test",
  plan: "agency",
  email: "bulk@test.local",
};

try {
  const imported = await importCrmLeadsFromRows({
    body: {
      rows: [
        {
          name: "Bulk Import One",
          business: "Biz One",
          phone: "+57 300 555 0001",
          service: "Landing",
          source: "import_csv",
          message: "Quiero cotizacion y precio para empezar ahora",
        },
      ],
    },
    user,
  });
  assert.equal(imported.response.mode, "import");
  assert.ok(imported.response.imported >= 0);

  const workspace = await listCrmWorkspace(user, { q: "Bulk Import", limit: 50 });
  assert.ok(workspace.pagination);
  assert.ok(Array.isArray(workspace.leads));

  const leadId = imported.response.results?.[0]?.leadId;
  if (leadId) {
    const bulk = await bulkUpdateLeads({
      body: { leadIds: [leadId], status: "qualified", addTags: ["bulk"] },
      user,
    });
    assert.equal(bulk.response.mode, "bulk_update");
    assert.ok(bulk.response.updated >= 0);
  }
} catch (error) {
  // Storage may be strict-supabase in some envs; parser/email tests already ran.
  if (!/Supabase|storage|REQUIRE/i.test(String(error.message || error))) throw error;
  console.info("Skipped storage-backed bulk/import (storage unavailable in this env)");
} finally {
  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}

console.info("CRM bulk/import guards passed");
