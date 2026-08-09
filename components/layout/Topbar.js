import { animateStateSignal } from "../motion.js";

/**
 * Topbar: title, live status, theme toggle, user meta.
 */
export function createTopbar({
  title = "Inicio",
  subtitle = "Agencia · cartera",
  userEmail = "",
  online = true,
  theme = "light",
  onThemeToggle,
  onRefresh,
} = {}) {
  const bar = document.createElement("header");
  bar.className = "crm-topbar";

  const left = document.createElement("div");
  left.className = "crm-topbar__left";
  left.innerHTML = `
    <div class="crm-topbar__eyebrow">${subtitle}</div>
    <h1 class="crm-topbar__title">${title}</h1>
  `;

  const right = document.createElement("div");
  right.className = "crm-topbar__right";

  const status = document.createElement("div");
  status.className = "crm-topbar__status" + (online ? " is-online" : "");
  status.innerHTML = `
    <span class="crm-topbar__dot" aria-hidden="true"></span>
    <span class="crm-topbar__status-text">${online ? "En línea" : "Sin conexión"}</span>
  `;

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "ui-btn ui-btn--secondary ui-btn--sm";
  themeBtn.textContent = theme === "dark" ? "Claro" : "Oscuro";
  themeBtn.addEventListener("click", () => onThemeToggle?.());

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "ui-btn ui-btn--secondary ui-btn--sm";
  refreshBtn.textContent = "Actualizar";
  refreshBtn.addEventListener("click", () => onRefresh?.());

  const user = document.createElement("div");
  user.className = "crm-topbar__user";
  user.innerHTML = `
    <span class="crm-topbar__user-label">Cuenta</span>
    <span class="crm-topbar__user-email">${escapeHtml(userEmail || "—")}</span>
  `;
  user.title = userEmail || "";

  right.append(status, themeBtn, refreshBtn, user);
  bar.append(left, right);

  bar.setTitle = (t, s) => {
    left.querySelector(".crm-topbar__title").textContent = t;
    if (s != null) left.querySelector(".crm-topbar__eyebrow").textContent = s;
  };
  bar.setOnline = (v) => {
    const changed = status.classList.contains("is-online") !== !!v;
    status.classList.toggle("is-online", !!v);
    status.querySelector(".crm-topbar__status-text").textContent = v ? "En línea" : "Sin conexión";
    if (changed) animateStateSignal(status.querySelector(".crm-topbar__dot"), !!v);
  };
  bar.setThemeLabel = (mode) => {
    themeBtn.textContent = mode === "dark" ? "Claro" : "Oscuro";
  };

  return bar;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const topbarStyles = `
.crm-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 56px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-canvas);
}
.crm-topbar__eyebrow {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-2);
}
.crm-topbar__title {
  margin: 2px 0 0;
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  color: var(--color-text);
}
.crm-topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.crm-topbar__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: var(--text-meta);
  color: var(--color-text-2);
}
.crm-topbar__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-cold);
  flex-shrink: 0;
}
.crm-topbar__status.is-online .crm-topbar__dot {
  background: var(--color-success);
  box-shadow: 0 0 0 3px var(--color-success-soft);
}
.crm-topbar__status-text {
  white-space: nowrap;
  width: auto !important;
  height: auto !important;
  font-size: var(--text-meta);
  text-transform: none;
}
.crm-topbar__user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 4px 10px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  min-width: 140px;
}
.crm-topbar__user-label {
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-mute);
}
.crm-topbar__user-email {
  font-size: var(--text-meta);
  color: var(--color-text);
  text-transform: none;
  font-weight: var(--font-weight-medium);
  max-width: min(32ch, 42vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .crm-topbar {
    align-items: stretch;
    padding: 10px 12px;
  }
  .crm-topbar__right {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
  }
  .crm-topbar__status {
    min-width: 0;
    height: 44px;
  }
  .crm-topbar__user {
    grid-column: 1 / -1;
    align-items: flex-start;
    min-width: 0;
  }
  .crm-topbar__user-email {
    max-width: 100%;
  }
}
`;
