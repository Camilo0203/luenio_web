import { listCrmData } from "../../db/storage.js";
import { normalizeLeadInput, processCrmLead } from "./lead-capture-service.js";
import { importCrmLeadsFromRows } from "./lead-import-service.js";
import {
  isLeadUpdateRequest,
  LeadValidationError,
  PipelineStageValidationError,
} from "./lead-validation-service.js";
import { applyLeadUpdate, bulkUpdateLeads } from "./lead-update-service.js";

// LeadValidationError/PipelineStageValidationError: re-exported for api/process.js.
export { LeadValidationError, PipelineStageValidationError };

function buildLeadProcessResponse({ lead, actionLog, stored, usage }) {
  return {
    ok: true,
    mode: "processed",
    lead,
    action: actionLog,
    usage,
    storedLeads: stored.storedLeads,
  };
}

export async function processCrmRequestBody({ body = {}, user }) {
  if (body.mode === "digest") {
    const { buildDailyDigest } = await import("./digest-service.js");
    const tenantId = user.businessId || user.id;
    const data = await listCrmData(tenantId);
    const digest = buildDailyDigest(data.leads || [], { now: new Date() });
    return { response: { ok: true, mode: "digest", digest } };
  }

  if (body.mode === "bulk") {
    return bulkUpdateLeads({ body, user });
  }

  if (body.mode === "import") {
    return importCrmLeadsFromRows({ body, user });
  }

  if (isLeadUpdateRequest(body)) {
    const tenantId = user.businessId || user.id;
    const currentData = await listCrmData(tenantId);
    const existingLead = (currentData.leads || []).find((lead) => lead.id === body.leadId);
    if (!existingLead) {
      const error = new Error("Lead not found in this workspace.");
      error.statusCode = 404;
      throw error;
    }

    const { pipelineOnly, result } = await applyLeadUpdate({
      leadId: body.leadId,
      tenantId,
      patch: { ...body, actorUserId: user.id },
      existingLead,
    });
    return {
      response: {
        ok: true,
        mode: pipelineOnly ? "pipeline_update" : "lead_update",
        lead: result.lead,
      },
    };
  }

  const lead = normalizeLeadInput(body.lead || body);
  const processed = await processCrmLead({ lead, user });
  return {
    ...processed,
    lead,
    response: buildLeadProcessResponse({ lead, ...processed }),
  };
}
