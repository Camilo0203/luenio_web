/**
 * Structured one-line JSON logs without free-form PII fields.
 */

const BLOCKED_KEYS = new Set([
  "phone",
  "email",
  "message",
  "notes",
  "password",
  "token",
  "authorization",
  "cookie",
]);

function sanitizeFields(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_KEYS.has(String(key).toLowerCase())) continue;
    if (value === undefined) continue;
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function emit(level, event, fields = {}) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...sanitizeFields(fields),
  });
  if (level === "error") console.error(line);
  else console.info(line);
}

export function logInfo(event, fields) {
  emit("info", event, fields);
}

export function logError(event, fields) {
  emit("error", event, fields);
}
