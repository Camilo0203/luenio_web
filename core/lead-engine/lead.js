import { generateRecordId } from "../ids.js";
import { scoreLead, classifyLead } from "../scoring/index.js";
import { getPipelineStage } from "../pipeline/index.js";
import {
  leadFieldLimits,
  normalizeTextField,
  normalizeNotes,
  normalizeTags,
  normalizeNextAction,
  normalizeOptionalIsoDate,
} from "./normalize.js";
import { normalizeContactLog } from "./contact-log.js";

function normalizeSource(value) {
  const source = normalizeTextField(value, leadFieldLimits.source)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return source || "direct";
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
