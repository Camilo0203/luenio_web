import { assertLeadLimit, getLeadUsage } from "../../config/billing.js";
import { buildPipelineUpdatedEvent } from "../../core/events.js";
import { isValidPipelineStage, normalizeLead, validateLead } from "../../core/engine.js";
import {
  assertNoRecentLeadDuplicate,
  getStorageMode,
  listCrmData,
  storeCrmRecord,
  updateLeadPipeline,
} from "../../db/storage.js";
import { runAutomationEngine } from "./automation-service.js";
import { buildCrmRecordBundle } from "./crm-record-service.js";

export class LeadValidationError extends Error {
  constructor(missingFields) {
    super("Missing required fields");
    this.name = "LeadValidationError";
    this.statusCode = 400;
    this.missingFields = missingFields;
  }
}

export class PipelineStageValidationError extends Error {
  constructor() {
    super("Invalid pipeline stage.");
    this.name = "PipelineStageValidationError";
    this.statusCode = 400;
    this.storage = getStorageMode();
  }
}

function assertValidLead(lead) {
  const missingFields = validateLead(lead);
  if (missingFields.length) throw new LeadValidationError(missingFields);
}

function normalizeLeadInput(body = {}) {
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
    storage: stored.storage,
    storedLeads: stored.storedLeads,
    usage,
    userId: user.id,
  };
}

function buildLeadProcessResponse({ lead, actionLog, stored, usage }) {
  return {
    ok: true,
    mode: "processed",
    lead,
    action: actionLog,
    usage,
    storage: stored.storage,
    storedLeads: stored.storedLeads,
  };
}

function buildLeadStoredLog({ lead, actionLog, stored }) {
  return {
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    classification: lead.classification,
    workflow: actionLog.workflow,
    storage: stored.storage,
  };
}

function isPipelineUpdateRequest(body = {}) {
  return Boolean(body.leadId && body.status);
}

function normalizePipelineUpdates(body = {}) {
  if (
    !isValidPipelineStage(body.status) ||
    (body.pipelineStage && !isValidPipelineStage(body.pipelineStage))
  ) {
    throw new PipelineStageValidationError();
  }

  return {
    status: body.status,
    pipelineStage: body.pipelineStage || body.status,
  };
}

export async function processCrmLead({ lead, user }) {
  const currentData = await listCrmData(user.id);
  assertNoRecentLeadDuplicate(currentData.leads, lead.phone);
  assertLeadLimit(user, currentData.leads);

  const actionLog = await runAutomationEngine(lead, { plan: user.plan });
  const crmRecord = buildCrmRecordBundle({ lead, actionLog, userId: user.id });
  const stored = await storeCrmRecord(crmRecord);
  const usage = getLeadUsage(user, [lead, ...(currentData.leads || [])]);

  return {
    actionLog,
    stored,
    usage,
  };
}

export async function listCrmWorkspace(user) {
  const data = await listCrmData(user.id);
  return { ok: true, ...data };
}

export async function captureCrmLeadFromBody({ body = {}, user }) {
  const lead = normalizeLeadInput(body);
  const processed = await processCrmLead({ lead, user });

  return {
    ...processed,
    lead,
    log: buildLeadStoredLog({ lead, actionLog: processed.actionLog, stored: processed.stored }),
    response: buildLeadCaptureResponse({ lead, ...processed, user }),
  };
}

export async function processCrmRequestBody({ body = {}, user }) {
  if (isPipelineUpdateRequest(body)) {
    const updates = normalizePipelineUpdates(body);
    const pipelineEvent = buildPipelineUpdatedEvent({
      userId: user.id,
      leadId: body.leadId,
      updates,
    });
    const result = await updateLeadPipeline(body.leadId, updates, user.id, pipelineEvent);
    return { response: { ok: true, mode: "pipeline_update", ...result } };
  }

  const lead = normalizeLeadInput(body.lead || body);
  const processed = await processCrmLead({ lead, user });
  return {
    ...processed,
    lead,
    response: buildLeadProcessResponse({ lead, ...processed }),
  };
}
