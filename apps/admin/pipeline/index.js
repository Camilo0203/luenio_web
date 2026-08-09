/**
 * Pipeline module barrel — kanban stages for the private CRM.
 * Stage constants mirror core/pipeline; UI board is rendered from admin.js.
 */
export const pipelineStages = ["new", "qualified", "contacted", "converted"];
export { stageLabel, classificationLabel, safeText } from "../src/format.js";
