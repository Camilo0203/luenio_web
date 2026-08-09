const REASON_LABELS = {
  valid_phone: "Teléfono válido",
  detailed_message: "Mensaje detallado",
  low_intent_cap: "Intención exploratoria (tope de score)",
};

export function humanizeScoreReason(reason) {
  const text = String(reason || "");
  if (REASON_LABELS[text]) return REASON_LABELS[text];
  if (text.startsWith("high_intent:")) {
    return `Alta intención: “${text.slice("high_intent:".length)}”`;
  }
  if (text.startsWith("medium_intent:")) {
    return `Intención media: “${text.slice("medium_intent:".length)}”`;
  }
  if (text.startsWith("high_value_source:")) {
    return `Fuente valiosa: ${text.slice("high_value_source:".length)}`;
  }
  return text;
}

export function formatScoreReasons(reasons = []) {
  if (!Array.isArray(reasons) || !reasons.length) return ["Sin señales registradas"];
  return reasons.map(humanizeScoreReason);
}
