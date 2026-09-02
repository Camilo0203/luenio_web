import { validateLead } from "../../core/engine.js";

export class LeadValidationError extends Error {
  constructor(missingFields) {
    super("Missing required fields");
    this.name = "LeadValidationError";
    this.statusCode = 400;
    this.missingFields = missingFields;
  }
}

export class PipelineStageValidationError extends Error {
  constructor(message = "Invalid pipeline stage.") {
    super(message);
    this.name = "PipelineStageValidationError";
    this.statusCode = 400;
  }
}

export function assertValidLead(lead) {
  const missingFields = validateLead(lead);
  if (missingFields.length) throw new LeadValidationError(missingFields);
}

export function isLeadUpdateRequest(body = {}) {
  return Boolean(
    body.leadId &&
    (body.status ||
      body.notes !== undefined ||
      body.tags !== undefined ||
      body.nextAction !== undefined ||
      body.nextActionAt !== undefined ||
      body.assigneeUserId !== undefined ||
      body.logContact ||
      body.contactLogEntry),
  );
}

export function isPipelineOnlyUpdate(updates) {
  const keys = Object.keys(updates);
  return (
    updates.status !== undefined && keys.every((key) => key === "status" || key === "pipelineStage")
  );
}

export function leadMatchesQuery(lead, query) {
  if (!query) return true;
  const tags = Array.isArray(lead.tags) ? lead.tags : [];
  const haystack = [
    lead.name,
    lead.business,
    lead.phone,
    lead.service,
    lead.message,
    lead.source,
    lead.notes,
    lead.nextAction || lead.next_action,
    ...tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}
