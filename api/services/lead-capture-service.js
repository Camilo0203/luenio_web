import { assertLeadLimit, getLeadUsage } from "../../config/billing.js";
import { normalizeLead } from "../../core/engine.js";
import { assertNoRecentLeadDuplicate, listCrmData, storeCrmRecord } from "../../db/storage.js";
import { buildAutomationDeliveryPlan } from "./automation-service.js";
import { deliverQueuedAutomationActions } from "./automation-delivery-service.js";
import { buildCrmRecordBundle } from "./crm-record-service.js";
import { assertValidLead } from "./lead-validation-service.js";

export function normalizeLeadInput(body = {}) {
  const lead = normalizeLead(body);
  assertValidLead(lead);
  return lead;
}

function buildLeadCaptureResponse({ lead, actionLog, stored, usage, user }) {
  return {
    ok: true,
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    classification: lead.classification,
    workflow: actionLog.workflow,
    actions: actionLog.actions,
    restrictedActions: actionLog.restrictedActions || [],
    integrations: actionLog.integrationResults,
    internalActions: actionLog.internalActionResults,
    scoreReasons: lead.scoreReasons,
    storedLeads: stored.storedLeads,
    usage,
    userId: user.id,
  };
}

function buildLeadStoredLog({ lead, actionLog }) {
  return {
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    classification: lead.classification,
    workflow: actionLog.workflow,
  };
}

export async function processCrmLead({ lead, user }) {
  const tenantId = user.businessId || user.id;
  const currentData = await listCrmData(tenantId);
  assertNoRecentLeadDuplicate(currentData.leads, lead.phone);
  assertLeadLimit(user, currentData.leads);

  // Persist first: the plan and its queued deliveries land in storage before
  // any network I/O is attempted, so a crash between here and the delivery
  // attempt below loses nothing -- automation-delivery-worker.js picks the
  // queued rows back up. Mirrors capturePublicInquiry's persist-then-deliver
  // order in contact-service.js.
  const { plan, deliveries } = buildAutomationDeliveryPlan(lead, { plan: user.plan });
  const crmRecord = buildCrmRecordBundle({ lead, actionLog: plan, userId: tenantId, deliveries });
  const stored = await storeCrmRecord(crmRecord);

  // Best-effort immediate attempt (same latency shape as before this change);
  // anything not delivered here is left "pending"/"retry" for the worker.
  // deliverQueuedAutomationActions only returns outcomes for actions that
  // were actually queued (had a configured destination) -- merge those back
  // by label, in the plan's original order, so "not_configured" entries
  // (never queued) survive untouched.
  const deliveredResults = deliveries.length
    ? await deliverQueuedAutomationActions({ leadId: lead.id, limit: deliveries.length })
    : [];
  const deliveredByLabel = new Map(deliveredResults.map((result) => [result.label, result]));
  const integrationResults = plan.integrationResults.map(
    (queued) => deliveredByLabel.get(queued.label) || queued,
  );
  const actionLog = { ...plan, integrationResults };

  const usage = getLeadUsage(user, [lead, ...(currentData.leads || [])]);

  return {
    actionLog,
    stored,
    usage,
  };
}

export async function captureCrmLeadFromBody({ body = {}, user }) {
  const lead = normalizeLeadInput(body);
  const processed = await processCrmLead({ lead, user });

  return {
    ...processed,
    lead,
    log: buildLeadStoredLog({ lead, actionLog: processed.actionLog }),
    response: buildLeadCaptureResponse({ lead, ...processed, user }),
  };
}
