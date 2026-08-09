const TONE = {
  default: "ui-badge--default",
  success: "ui-badge--success",
  warning: "ui-badge--warning",
  danger: "ui-badge--danger",
  accent: "ui-badge--accent",
  cold: "ui-badge--cold",
};

export function createBadge({ label, tone = "default", className = "" } = {}) {
  const el = document.createElement("span");
  el.className = ["ui-badge", TONE[tone] || TONE.default, className].filter(Boolean).join(" ");
  el.textContent = label;
  return el;
}

/** Map domain status → badge tone */
export function toneForStatus(status) {
  const map = {
    activo: "success",
    pagada: "success",
    ganado: "success",
    completado: "success",
    enviada: "accent",
    propuesta: "accent",
    negociacion: "warning",
    prospecto: "warning",
    pausado: "warning",
    vencida: "danger",
    perdido: "danger",
    churned: "danger",
    borrador: "cold",
    inactivo: "cold",
    nuevo: "default",
    contactado: "default",
  };
  return map[status] || "default";
}
