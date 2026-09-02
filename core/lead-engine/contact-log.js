import { generateRecordId } from "../ids.js";
import { leadFieldLimits, normalizeTextField, normalizeOptionalIsoDate } from "./normalize.js";

export const CONTACT_LOG_TYPES = ["whatsapp", "call", "email", "note", "other"];

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
