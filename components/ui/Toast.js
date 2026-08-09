let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "ui-toast-host";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

/**
 * @param {{ message: string, tone?: 'success'|'error'|'info', duration?: number }} opts
 */
export function showToast({ message, tone = "info", duration = 4000 } = {}) {
  const root = ensureHost();
  while (root.children.length >= 4) root.firstElementChild?.remove();
  const el = document.createElement("div");
  el.className = `ui-toast ui-toast--${tone}`;
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.textContent = message;
  root.appendChild(el);

  requestAnimationFrame(() => el.classList.add("ui-toast--in"));

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.remove("ui-toast--in");
    el.classList.add("ui-toast--out");
    setTimeout(() => el.remove(), 220);
  };

  const t = setTimeout(remove, duration);
  el.addEventListener("click", () => {
    clearTimeout(t);
    remove();
  });

  return { dismiss: remove };
}

export const toastStyles = `
.ui-toast-host {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
}
.ui-toast {
  pointer-events: auto;
  min-width: 220px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-md);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
  opacity: 0;
  transform: translateY(8px);
  clip-path: inset(100% 0 0 0 round var(--radius-card));
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out),
    clip-path var(--duration-normal) var(--ease-out);
  cursor: pointer;
}
.ui-toast--in {
  opacity: 1;
  transform: translateY(0);
  clip-path: inset(0 round var(--radius-card));
}
.ui-toast--out {
  opacity: 0;
  transform: translateY(4px);
  clip-path: inset(0 0 100% 0 round var(--radius-card));
}
.ui-toast--success { border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border)); }
.ui-toast--error { border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border)); }
.ui-toast--info { border-color: var(--color-accent-border); }
@media (max-width: 640px) {
  .ui-toast-host {
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(76px + env(safe-area-inset-bottom));
    left: max(12px, env(safe-area-inset-left));
  }
  .ui-toast {
    width: 100%;
    min-width: 0;
    max-width: none;
  }
}
`;
