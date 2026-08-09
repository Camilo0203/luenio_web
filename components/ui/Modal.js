import { createButton } from "./Button.js";

let modalSequence = 0;

function focusableElements(root) {
  return [
    ...root.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

/**
 * Accessible modal with focus trap basics and escape to close.
 * onConfirm may return false (or a Promise resolving to false) to keep the modal open.
 */
export function openModal({
  title,
  body,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
} = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ui-modal-overlay";
  overlay.setAttribute("role", "presentation");

  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement("div");
  dialog.className = "ui-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.tabIndex = -1;

  const head = document.createElement("div");
  head.className = "ui-modal__head";
  const h = document.createElement("h2");
  h.className = "ui-modal__title";
  h.id = `ui-modal-title-${++modalSequence}`;
  h.textContent = title || "";
  dialog.setAttribute("aria-labelledby", h.id);
  head.append(h);

  const content = document.createElement("div");
  content.className = "ui-modal__body";
  if (typeof body === "string") content.textContent = body;
  else if (body instanceof Node) content.append(body);

  const foot = document.createElement("div");
  foot.className = "ui-modal__foot";

  let closed = false;
  let pending = false;
  const dismiss = (reason) => {
    if (closed || pending) return;
    closed = true;
    overlay.classList.add("ui-modal-overlay--out");
    setTimeout(() => {
      overlay.remove();
      previousFocus?.focus();
    }, 180);
    document.removeEventListener("keydown", onKey);
    if (reason === "cancel") onCancel?.();
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      dismiss("cancel");
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = focusableElements(dialog);
    if (!focusable.length) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKey);

  const cancelBtn = createButton({
    label: cancelLabel,
    variant: "secondary",
    onClick: () => dismiss("cancel"),
  });

  const status = document.createElement("p");
  status.className = "ui-modal__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;

  const confirmBtn = createButton({
    label: confirmLabel,
    variant: danger ? "danger" : "primary",
    onClick: async () => {
      if (pending) return;
      pending = true;
      dialog.setAttribute("aria-busy", "true");
      cancelBtn.disabled = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Procesando…";
      status.hidden = true;
      try {
        const result = await onConfirm?.();
        if (result === false) {
          pending = false;
          dialog.removeAttribute("aria-busy");
          cancelBtn.disabled = false;
          confirmBtn.disabled = false;
          confirmBtn.textContent = confirmLabel;
          return;
        }
        pending = false;
        dismiss("confirm");
      } catch {
        pending = false;
        dialog.removeAttribute("aria-busy");
        cancelBtn.disabled = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmLabel;
        status.textContent =
          "No pudimos completar la acción. Revisa los datos e inténtalo de nuevo.";
        status.setAttribute("role", "alert");
        status.setAttribute("aria-live", "assertive");
        status.hidden = false;
        confirmBtn.focus();
      }
    },
  });

  foot.append(cancelBtn, confirmBtn);

  dialog.append(head, content, status, foot);
  overlay.append(dialog);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss("cancel");
  });
  if (body instanceof HTMLFormElement) {
    body.addEventListener("submit", (event) => {
      event.preventDefault();
      confirmBtn.click();
    });
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add("ui-modal-overlay--in");
    (focusableElements(dialog)[0] || dialog).focus();
  });

  return { close: () => dismiss("cancel") };
}

export const modalStyles = `
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(8, 13, 22, 0.55);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}
.ui-modal-overlay--in { opacity: 1; }
.ui-modal-overlay--out { opacity: 0; }
.ui-modal {
  width: min(440px, 100%);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-md);
  transform: translateY(8px) scale(0.98);
  transition: transform var(--duration-normal) var(--ease-out);
}
.ui-modal-overlay--in .ui-modal {
  transform: translateY(0) scale(1);
}
.ui-modal__head {
  padding: 16px 16px 0;
}
.ui-modal__title {
  margin: 0;
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
}
.ui-modal__body {
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: var(--text-body-md);
  color: var(--color-text-2);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ui-modal__status {
  margin: -4px 16px 12px;
  color: var(--color-danger);
  font-size: var(--text-meta);
  line-height: 1.45;
}
.ui-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 16px 16px;
}
.ui-modal-form {
  display: grid;
  gap: 10px;
}
.ui-modal-form label {
  display: grid;
  gap: 4px;
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-2);
}
.ui-modal-form input,
.ui-modal-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-deep, var(--color-canvas));
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-body);
}
.ui-modal-form input:focus,
.ui-modal-form select:focus {
  outline: 2px solid var(--color-accent-soft, rgba(15,61,86,0.25));
  border-color: var(--color-accent);
}
.ui-modal-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 640px) {
  .ui-modal-overlay {
    place-items: end center;
    padding: 8px max(8px, env(safe-area-inset-right)) 0
      max(8px, env(safe-area-inset-left));
  }
  .ui-modal {
    width: 100%;
    max-height: calc(100dvh - max(16px, env(safe-area-inset-top)));
    border-radius: var(--radius-panel) var(--radius-panel) 0 0;
    transform: translateY(16px);
  }
  .ui-modal__head {
    padding-top: 18px;
  }
  .ui-modal__foot {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
  .ui-modal__foot .ui-btn {
    flex: 1;
  }
  .ui-modal-form__row {
    grid-template-columns: 1fr;
  }
}
`;
