import { generateRecordId } from "./ids.js";

export { generateRecordId } from "./ids.js";

export const pipelineStages = ["new", "qualified", "contacted", "converted"];

export const leadFieldLimits = {
  name: 80,
  business: 120,
  phone: 32,
  service: 120,
  message: 1000,
  source: 40,
};

const highIntentTerms = [
  "quiero automatizar",
  "precio",
  "precios",
  "empezar ahora",
  "cotizacion",
  "automatizar mis ventas",
];
const mediumIntentTerms = ["whatsapp", "crm", "seguimiento", "leads", "informacion", "demo"];
const lowIntentTerms = ["curiosidad", "curioso", "solo mirando", "solo quiero ver", "mas adelante"];

function normalizeForScoring(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeTextField(value, limit = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeSource(value) {
  const source = normalizeTextField(value, leadFieldLimits.source)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return source || "direct";
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

export function getPipelineStage(score) {
  if (score >= 95) return "converted";
  if (score >= 80) return "contacted";
  if (score >= 60) return "qualified";
  return "new";
}

export function isValidPipelineStage(stage) {
  return pipelineStages.includes(String(stage || "").trim());
}

export function normalizePipelineStage(stage) {
  const normalizedStage = String(stage || "").trim();
  return isValidPipelineStage(normalizedStage) ? normalizedStage : null;
}

export function buildWorkflow(lead) {
  if (lead.score >= 80) {
    return {
      type: "hot_lead_workflow",
      segment: "hot_leads",
      actions: [
        "create_crm_deal",
        "send_webhook",
        "send_crm_webhook",
        "send_whatsapp_notification",
        "assign_sales_owner",
      ],
    };
  }
  if (lead.score >= 60) {
    return {
      type: "sales_notification",
      segment: "qualified_leads",
      actions: ["create_crm_record", "send_webhook", "send_crm_webhook", "send_email_notification"],
    };
  }
  return {
    type: "nurture_sequence",
    segment: "nurture",
    actions: [
      "create_crm_record",
      "add_to_nurture_segment",
      "schedule_followup",
      "send_webhook",
      "send_crm_webhook",
    ],
  };
}

export function normalizeLead(rawLead = {}) {
  const sanitizedLead = {
    name: normalizeTextField(rawLead.name, leadFieldLimits.name),
    business: normalizeTextField(rawLead.business, leadFieldLimits.business),
    phone: normalizeTextField(rawLead.phone, leadFieldLimits.phone),
    service: normalizeTextField(rawLead.service, leadFieldLimits.service),
    message: normalizeTextField(rawLead.message, leadFieldLimits.message),
    source: normalizeSource(rawLead.source),
  };
  const scoring = scoreLead(sanitizedLead);
  const classification = classifyLead(scoring.score);
  const pipelineStage = getPipelineStage(scoring.score);
  const timestamp = new Date().toISOString();

  return {
    id: generateRecordId("lead"),
    ...sanitizedLead,
    score: scoring.score,
    scoreReasons: scoring.reasons,
    classification,
    status: pipelineStage,
    pipelineStage,
    timestamp,
    updatedAt: timestamp,
  };
}

export function validateLead(lead) {
  return ["name", "business", "phone", "service"].filter(
    (field) => !String(lead[field] || "").trim(),
  );
}

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
