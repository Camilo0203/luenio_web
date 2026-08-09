/**
 * Rule-based lead scoring (Spanish/LATAM intent lexicon).
 * Thresholds: hot >= 80, warm >= 60, cold < 60.
 */

const highIntentTerms = [
  "quiero automatizar",
  "precio",
  "precios",
  "empezar ahora",
  "cotizacion",
  "cotizar",
  "contratar",
  "urgente",
  "esta semana",
  "presupuesto",
  "whatsapp business",
  "automatizar mis ventas",
];

const mediumIntentTerms = [
  "whatsapp",
  "crm",
  "seguimiento",
  "leads",
  "informacion",
  "demo",
  "automatizacion",
  "landing",
  "agendar",
];

const lowIntentTerms = [
  "curiosidad",
  "curioso",
  "solo mirando",
  "solo quiero ver",
  "mas adelante",
  "despues",
  "investigando",
  "solo info",
];

function normalizeForScoring(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function scoreLead(lead) {
  const text = normalizeForScoring(`${lead.service || ""} ${lead.message || ""}`);
  const reasons = [];
  const hasHighIntent = highIntentTerms.some((term) => text.includes(term));
  const hasLowIntent = lowIntentTerms.some((term) => text.includes(term));
  let score = 35;

  highIntentTerms.forEach((term) => {
    if (text.includes(term)) {
      score += 18;
      reasons.push(`high_intent:${term}`);
    }
  });
  mediumIntentTerms.forEach((term) => {
    if (text.includes(term)) {
      score += 8;
      reasons.push(`medium_intent:${term}`);
    }
  });
  if (String(lead.phone || "").replace(/\D/g, "").length >= 10) {
    score += 8;
    reasons.push("valid_phone");
  }
  if (String(lead.message || "").length > 40) {
    score += 10;
    reasons.push("detailed_message");
  }
  if (["hero", "pricing", "demo", "contacto", "contact"].includes(lead.source)) {
    score += 10;
    reasons.push(`high_value_source:${lead.source}`);
  }
  if (hasLowIntent && !hasHighIntent) {
    score = Math.min(score, 42);
    reasons.push("low_intent_cap");
  }

  return { score: Math.min(score, 100), reasons };
}

export function classifyLead(score) {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  return "cold";
}

/** Human-readable score summary for CRM UI. */
export function explainScore(lead) {
  const scoring = lead.scoreReasons
    ? { score: lead.score, reasons: lead.scoreReasons }
    : scoreLead(lead);
  const classification = lead.classification || classifyLead(scoring.score);
  return {
    score: scoring.score,
    classification,
    reasons: scoring.reasons || [],
  };
}
