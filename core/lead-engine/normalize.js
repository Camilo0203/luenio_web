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
