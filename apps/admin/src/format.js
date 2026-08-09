const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };
const STAGE_LABELS = {
  new: "Nuevo",
  qualified: "Calificado",
  contacted: "Contactado",
  converted: "Convertido",
};

export function classificationLabel(value) {
  return CLASSIFICATION_LABELS[value] || value;
}

export function stageLabel(value) {
  return STAGE_LABELS[value] || value;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return escapeHtml(normalized || fallback);
}

export function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getClassification(lead) {
  return lead.classification || (lead.score >= 80 ? "hot" : lead.score >= 60 ? "warm" : "cold");
}
