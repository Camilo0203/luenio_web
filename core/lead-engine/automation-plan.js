import { generateRecordId } from "../ids.js";
import { buildWorkflow } from "../pipeline/index.js";

export function buildAutomationPlan(lead, options = {}) {
  const workflow = buildWorkflow(lead);
  const allowedActionSet = Array.isArray(options.allowedActions)
    ? new Set(options.allowedActions)
    : null;
  const allowedActions = allowedActionSet
    ? workflow.actions.filter((action) => allowedActionSet.has(action))
    : workflow.actions;
  const timestamp = new Date().toISOString();
  const payload = {
    lead,
    score: lead.score,
    classification: lead.classification,
    pipelineStage: lead.pipelineStage,
    source: lead.source,
    timestamp,
    workflow: workflow.type,
    segment: workflow.segment,
  };

  const internalActionResults = allowedActions
    .filter((action) => !action.startsWith("send_"))
    .map((action) => ({
      label: action,
      status: "executed",
      destination: "luenio_crm",
      timestamp,
    }));

  return {
    id: generateRecordId("action"),
    leadId: lead.id,
    timestamp,
    workflow: workflow.type,
    segment: workflow.segment,
    actions: allowedActions,
    restrictedActions: workflow.actions.filter((action) => !allowedActions.includes(action)),
    score: lead.score,
    classification: lead.classification,
    pipelineStage: lead.pipelineStage,
    scoreReasons: lead.scoreReasons,
    payload,
    integrationResults: [],
    internalActionResults,
  };
}
