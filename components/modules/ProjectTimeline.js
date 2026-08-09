import { createBadge, toneForStatus } from "../ui/Badge.js";
import { createEmptyState } from "../ui/EmptyState.js";
import { animateResolvedBars } from "../motion.js";

function money(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * @param {{ projects: any[], onSelect?: (p: any) => void }} opts
 */
export function renderProjectTimeline({ projects = [], onSelect } = {}) {
  const root = document.createElement("section");
  root.className = "project-timeline stagger-in";
  root.setAttribute("aria-label", "Timeline de proyectos");

  if (!projects.length) {
    root.append(
      createEmptyState({
        title: "Sin proyectos",
        description: "Los proyectos de Neon se listan aquí. Alta de proyectos: seed/API por ahora.",
      }),
    );
    return root;
  }

  for (const p of projects) {
    const progressPercent = Math.min(100, Math.max(0, Number(p.progress_percent) || 0));
    const card = document.createElement("article");
    card.className = "project-card ui-surface ui-surface--panel ui-surface--interactive";
    if (onSelect) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Abrir proyecto ${p.name}`);
      card.addEventListener("click", () => onSelect(p));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(p);
        }
      });
    }

    const head = document.createElement("div");
    head.className = "project-card__head";
    const title = document.createElement("div");
    title.innerHTML = `
      <div class="project-card__name">${escapeHtml(p.name)}</div>
      <div class="project-card__client">${escapeHtml(p.client_company || p.client_name || "")}</div>
    `;
    head.append(title, createBadge({ label: p.status, tone: toneForStatus(p.status) }));

    const meta = document.createElement("div");
    meta.className = "project-card__meta";
    meta.innerHTML = `
      <span>${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</span>
      <span class="tabular">${money(p.budget)}</span>
      <span>${escapeHtml(p.owner_name || "Sin owner")}</span>
    `;

    const progress = document.createElement("div");
    progress.className = "project-card__progress";
    progress.innerHTML = `
      <div class="project-card__bar" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
        <div class="project-card__bar-fill" style="--progress:${progressPercent / 100}"></div>
      </div>
      <span class="project-card__pct">${progressPercent}%</span>
    `;

    card.append(head, meta, progress);
    root.append(card);
  }

  animateResolvedBars(root, ".project-card__bar-fill", {
    axis: "x",
    variable: "--progress",
  });
  return root;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const projectTimelineStyles = `
.project-timeline {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.project-card {
  padding: 14px;
  cursor: pointer;
}
.project-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.project-card__name {
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.project-card__client {
  margin-top: 2px;
  font-size: var(--text-meta);
  color: var(--color-text-2);
}
.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-top: 10px;
  font-size: var(--text-meta);
  color: var(--color-mute);
}
.project-card__meta .tabular {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-2);
  font-weight: var(--font-weight-semibold);
}
.project-card__progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.project-card__bar {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-deep);
  overflow: hidden;
}
.project-card__bar-fill {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
  transform: scaleX(var(--progress, 0));
  transform-origin: left;
  transition: transform var(--duration-normal) var(--ease-out);
}
.project-card__pct {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}
@media (max-width: 480px) {
  .project-card {
    padding: 12px;
  }
  .project-card__head {
    gap: 8px;
  }
  .project-card__meta {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
`;
