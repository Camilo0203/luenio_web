import { captureCrmLeadFromBody } from "./lead-capture-service.js";
import { PipelineStageValidationError } from "./lead-validation-service.js";

export async function importCrmLeadsFromRows({ body = {}, user }) {
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 100) : [];
  if (!rows.length) {
    throw new PipelineStageValidationError("rows is required for import.");
  }

  const results = [];
  let imported = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    try {
      const result = await captureCrmLeadFromBody({
        body: {
          name: row.name,
          business: row.business,
          phone: row.phone,
          service: row.service,
          message: row.message || "",
          source: row.source || "import_csv",
          tags: row.tags,
        },
        user,
      });
      imported += 1;
      results.push({ index, ok: true, leadId: result.lead?.id });
    } catch (error) {
      results.push({
        index,
        ok: false,
        error: error?.name === "LeadValidationError" ? "validation" : "import_failed",
        missingFields: error?.missingFields || undefined,
      });
    }
  }

  return {
    response: {
      ok: true,
      mode: "import",
      imported,
      failed: results.length - imported,
      results,
    },
  };
}
