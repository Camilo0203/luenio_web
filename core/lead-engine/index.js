import { generateRecordId } from "../ids.js";
import { scoreLead, classifyLead } from "../scoring/index.js";
import { getPipelineStage, buildWorkflow } from "../pipeline/index.js";

export const CONTACT_LOG_TYPES = ["whatsapp", "call", "email", "note", "other"];

export const leadFieldLimits = {
  name: 80,
  business: 120,
  phone: 32,
  email: 160,
  service: 120,
  message: 1000,
  source: 40,
  notes: 2000,
  tag: 32,
  maxTags: 12,
  nextAction: 200,
  contactSummary: 500,
  maxContactLog: 50,
};

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

/** Normalize free-form tags for CRM metadata. */
export function normalizeTags(rawTags) {
  const list = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags || "")
        .split(/[,;]/)
        .map((part) => part.trim());

  const normalized = [];
  const seen = new Set();

  for (const item of list) {
    const tag = normalizeTextField(item, leadFieldLimits.tag)
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúüñ _-]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length >= leadFieldLimits.maxTags) break;
  }

  return normalized;
}

export function normalizeNotes(value) {
  return normalizeTextField(value, leadFieldLimits.notes);
}

export function normalizeNextAction(value) {
  return normalizeTextField(value, leadFieldLimits.nextAction);
}

/** Parse ISO date or return null. Empty string clears. */
export function normalizeOptionalIsoDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeContactLogType(value) {
  const type = String(value || "")
    .trim()
    .toLowerCase();
  return CONTACT_LOG_TYPES.includes(type) ? type : "note";
}

export function normalizeContactLogEntry(raw = {}, { actorUserId = null } = {}) {
  const summary = normalizeTextField(raw.summary, leadFieldLimits.contactSummary);
  if (!summary) return null;
  return {
    id: raw.id && String(raw.id).startsWith("clog_") ? raw.id : generateRecordId("clog"),
    type: normalizeContactLogType(raw.type),
    summary,
    createdAt: normalizeOptionalIsoDate(raw.createdAt) || new Date().toISOString(),
    actorUserId: actorUserId || raw.actorUserId || null,
  };
}

export function appendContactLog(existingLog = [], entry, max = leadFieldLimits.maxContactLog) {
  if (!entry) return Array.isArray(existingLog) ? existingLog.slice(0, max) : [];
  const list = Array.isArray(existingLog) ? existingLog : [];
  return [entry, ...list].slice(0, max);
}

export function normalizeContactLog(rawLog) {
  if (!Array.isArray(rawLog)) return [];
  const entries = [];
  for (const item of rawLog) {
    const entry = normalizeContactLogEntry(item);
    if (entry) entries.push(entry);
    if (entries.length >= leadFieldLimits.maxContactLog) break;
  }
  return entries;
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
  const notes =
    rawLead.notes !== undefined && rawLead.notes !== null ? normalizeNotes(rawLead.notes) : "";
  const tags =
    rawLead.tags !== undefined && rawLead.tags !== null ? normalizeTags(rawLead.tags) : [];
  const nextAction =
    rawLead.nextAction !== undefined && rawLead.nextAction !== null
      ? normalizeNextAction(rawLead.nextAction)
      : rawLead.next_action !== undefined && rawLead.next_action !== null
        ? normalizeNextAction(rawLead.next_action)
        : "";
  const nextActionAt =
    rawLead.nextActionAt !== undefined || rawLead.next_action_at !== undefined
      ? normalizeOptionalIsoDate(rawLead.nextActionAt ?? rawLead.next_action_at)
      : null;
  const lastContactedAt =
    rawLead.lastContactedAt !== undefined || rawLead.last_contacted_at !== undefined
      ? normalizeOptionalIsoDate(rawLead.lastContactedAt ?? rawLead.last_contacted_at)
      : null;
  const contactLog = normalizeContactLog(rawLead.contactLog ?? rawLead.contact_log ?? []);

  return {
    id: generateRecordId("lead"),
    ...sanitizedLead,
    notes,
    tags,
    nextAction,
    nextActionAt,
    lastContactedAt,
    contactLog,
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
