import { createButton } from "./Button.js";

/**
 * Illustrated empty state with CTA.
 */
export function createEmptyState({
  title = "Sin datos todavía",
  description = "Cuando haya registros, aparecerán aquí.",
  ctaLabel,
  onCta,
} = {}) {
  const root = document.createElement("div");
  root.className = "ui-empty";
  root.setAttribute("role", "status");

  const art = document.createElement("div");
  art.className = "ui-empty__art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <rect x="8" y="14" width="48" height="36" rx="8" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/>
      <path d="M20 28h24M20 36h16" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="48" cy="18" r="6" fill="var(--color-accent-soft)" stroke="var(--color-accent)" stroke-width="1.2"/>
    </svg>
  `;

  const h = document.createElement("h3");
  h.className = "ui-empty__title";
  h.textContent = title;

  const p = document.createElement("p");
  p.className = "ui-empty__desc";
  p.textContent = description;

  root.append(art, h, p);

  if (ctaLabel && onCta) {
    root.append(createButton({ label: ctaLabel, variant: "primary", onClick: onCta }));
  }

  return root;
}

export const emptyStateStyles = `
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-2);
}
.ui-empty__art {
  color: var(--color-mute);
  margin-bottom: var(--space-2);
}
.ui-empty__title {
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}
.ui-empty__desc {
  margin: 0 0 var(--space-3);
  max-width: 320px;
  font-size: var(--text-body-md);
  color: var(--color-mute);
  line-height: 1.5;
}
`;
