/**
 * CRM module barrel — table, detail, metadata (notes/tags), CSV export.
 * UI orchestration remains in apps/admin/src/admin.js; helpers live under src/.
 */
export { downloadLeadsCsv } from "../src/export-csv.js";
export {
  classificationLabel,
  stageLabel,
  escapeHtml,
  safeText,
  safeNumber,
  getClassification,
} from "../src/format.js";
