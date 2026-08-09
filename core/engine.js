/**
 * Stable public surface for core lead logic.
 * Implementation lives in scoring/, pipeline/, and lead-engine/.
 */
export { generateRecordId } from "./ids.js";
export { scoreLead, classifyLead, explainScore } from "./scoring/index.js";
export {
  pipelineStages,
  getPipelineStage,
  isValidPipelineStage,
  normalizePipelineStage,
  buildWorkflow,
} from "./pipeline/index.js";
export {
  CONTACT_LOG_TYPES,
  leadFieldLimits,
  normalizeTextField,
  normalizeTags,
  normalizeNotes,
  normalizeNextAction,
  normalizeOptionalIsoDate,
  normalizeContactLogType,
  normalizeContactLogEntry,
  appendContactLog,
  normalizeContactLog,
  normalizeLead,
  validateLead,
  buildAutomationPlan,
} from "./lead-engine/index.js";
