import { createEmptyState } from "../ui/EmptyState.js";
import { createBadge } from "../ui/Badge.js";

const STAGES = [
  { id: "nuevo", label: "Nuevo" },
  { id: "contactado", label: "Contactado" },
  { id: "propuesta", label: "Propuesta" },
  { id: "negociacion", label: "Negociación" },
  { id: "ganado", label: "Ganado" },
  { id: "perdido", label: "Perdido" },
];

function money(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

/**
 * @param {{
 *   board: Record<string, any[]>,
 *   onSelect?: (lead: any) => void,
 *   onMove?: (payload: { id: string, stage: string, position: number }) => void
 *   onCreate?: () => void,
 *   focusLeadId?: string|null,
 * }} opts
 */
export function renderKanbanBoard({ board, onSelect, onMove, onCreate, focusLeadId = null } = {}) {
  const root = document.createElement("section");
  root.className = "kanban";
  root.setAttribute("aria-label", "Pipeline kanban");

  const toolbar = document.createElement("div");
  toolbar.className = "kanban__toolbar";
  if (onCreate) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ui-btn ui-btn--primary ui-btn--sm";
    btn.textContent = "Nuevo deal";
    btn.addEventListener("click", () => onCreate());
    toolbar.append(btn);
    root.append(toolbar);
  }

  const total = STAGES.reduce((n, s) => n + (board?.[s.id]?.length || 0), 0);
  if (!total) {
    root.append(
      createEmptyState({
        title: "Pipeline vacío",
        description: "Crea el primer deal para empezar a mover oportunidades por etapas.",
        ctaLabel: onCreate ? "Nuevo deal" : undefined,
        onCta: onCreate || undefined,
      }),
    );
    return root;
  }

  const scroller = document.createElement("div");
  scroller.className = "kanban__scroller stagger-in";

  for (const stage of STAGES) {
    const items = board?.[stage.id] || [];
    const col = document.createElement("div");
    col.className = "kanban__col";
    col.dataset.stage = stage.id;

    const head = document.createElement("div");
    head.className = "kanban__col-head";
    head.innerHTML = `
      <span class="kanban__col-title">${stage.label}</span>
      <span class="kanban__col-count">${items.length}</span>
    `;

    const list = document.createElement("div");
    list.className = "kanban__list";
    list.dataset.stage = stage.id;

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      list.classList.add("is-dragover");
    });
    list.addEventListener("dragleave", () => list.classList.remove("is-dragover"));
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("is-dragover");
      const id = e.dataTransfer.getData("text/lead-id");
      if (!id) return;
      const cards = [...list.querySelectorAll(".kanban-card")];
      let insertAt = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          insertAt = i;
          break;
        }
      }
      // position as ordered float among siblings (0,1,2...)
      onMove?.({ id, stage: stage.id, position: insertAt });
    });

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "kanban__empty";
      empty.innerHTML = `<span>Vacío</span><small>Arrastra un deal aquí</small>`;
      list.append(empty);
    } else {
      items.forEach((lead, index) => {
        list.append(
          createLeadCard(lead, {
            onSelect,
            index,
            focused: focusLeadId && String(focusLeadId) === String(lead.id),
          }),
        );
      });
    }

    col.append(head, list);
    scroller.append(col);
  }

  root.append(scroller);

  if (focusLeadId) {
    requestAnimationFrame(() => {
      const el = root.querySelector(
        `.kanban-card[data-lead-id="${CSS.escape(String(focusLeadId))}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
    });
  }

  return root;
}

function createLeadCard(lead, { onSelect, index, focused }) {
  const card = document.createElement("article");
  card.className =
    "kanban-card ui-surface ui-surface--card ui-surface--interactive" +
    (focused ? " is-focused" : "");
  card.draggable = window.matchMedia("(pointer: fine)").matches;
  card.dataset.leadId = lead.id;
  card.style.animationDelay = `${Math.min((index || 0) * 28, 168)}ms`;
  if (onSelect) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Abrir deal ${lead.name}`);
  }

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/lead-id", lead.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
  card.addEventListener("click", () => onSelect?.(lead));
  card.addEventListener("keydown", (event) => {
    if (onSelect && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect(lead);
    }
  });

  const title = document.createElement("div");
  title.className = "kanban-card__title";
  title.textContent = lead.name;

  const meta = document.createElement("div");
  meta.className = "kanban-card__meta";
  meta.textContent = lead.client_company || lead.client_contact || "Sin cliente";

  const foot = document.createElement("div");
  foot.className = "kanban-card__foot";
  const value = document.createElement("span");
  value.className = "kanban-card__value";
  value.textContent = money(lead.value);
  foot.append(value, createBadge({ label: `${lead.probability}%`, tone: "accent" }));

  if (lead.owner_name) {
    const owner = document.createElement("div");
    owner.className = "kanban-card__owner";
    owner.textContent = lead.owner_name;
    card.append(title, meta, foot, owner);
  } else {
    card.append(title, meta, foot);
  }

  return card;
}

export const kanbanStyles = `
.kanban {
  width: 100%;
  min-width: 0;
}
.kanban__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.kanban-card.is-focused {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 2px var(--color-accent-soft, rgba(15,61,86,0.15));
}
.kanban__scroller {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.kanban__col {
  --kanban-tone: var(--color-text-2);
  --kanban-tone-soft: var(--color-surface-deep);
  flex: 0 0 220px;
  background: color-mix(in srgb, var(--kanban-tone-soft) 76%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--kanban-tone) 18%, var(--color-border));
  border-radius: var(--radius-card);
  padding: 8px;
  min-height: 320px;
}
.kanban__col[data-stage="contactado"],
.kanban__col[data-stage="propuesta"] {
  --kanban-tone: var(--color-accent);
  --kanban-tone-soft: var(--color-accent-soft);
}
.kanban__col[data-stage="negociacion"] {
  --kanban-tone: var(--color-warning);
  --kanban-tone-soft: var(--color-warning-soft);
}
.kanban__col[data-stage="ganado"] {
  --kanban-tone: var(--color-success);
  --kanban-tone-soft: var(--color-success-soft);
}
.kanban__col[data-stage="perdido"] {
  --kanban-tone: var(--color-danger);
  --kanban-tone-soft: var(--color-danger-soft);
}
.kanban__scroller {
  min-height: 340px;
}
.kanban__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
}
.kanban__col-title {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kanban-tone);
}
.kanban__col-count {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--kanban-tone-soft);
  border: 1px solid color-mix(in srgb, var(--kanban-tone) 22%, var(--color-border));
  font-size: var(--text-caption);
  font-weight: var(--font-weight-bold);
  display: grid;
  place-items: center;
  color: var(--kanban-tone);
}
.kanban__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
  border-radius: var(--radius-control);
  transition: background var(--duration-fast) var(--ease-out);
}
.kanban__list.is-dragover {
  background: var(--color-accent-soft);
  box-shadow: inset 0 0 0 1px var(--color-accent-border);
}
.kanban__empty {
  display: grid;
  gap: 4px;
  place-items: center;
  min-height: 72px;
  padding: 16px 8px;
  text-align: center;
  font-size: var(--text-meta);
  color: var(--color-mute);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card-inner, 7px);
}
.kanban__empty span { font-weight: 600; color: var(--color-text-2); }
.kanban__empty small { font-size: var(--text-caption); }
.kanban-card {
  padding: 10px;
  cursor: grab;
  animation: luenio-record-resolve var(--duration-normal) var(--ease-out) both;
}
.kanban-card:active { cursor: grabbing; }
.kanban-card.is-dragging {
  opacity: 0.72;
  transform: scale(0.985) rotate(0.25deg);
  box-shadow: var(--shadow-md);
}
.kanban-card__title {
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.kanban-card__meta {
  margin-top: 4px;
  font-size: var(--text-meta);
  color: var(--color-text-2);
}
.kanban-card__foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kanban-card__value {
  font-size: var(--text-body);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}
.kanban-card__owner {
  margin-top: 8px;
  font-size: var(--text-caption);
  color: var(--color-mute);
}
@media (max-width: 640px) {
  .kanban__scroller {
    scroll-snap-type: inline proximity;
    scroll-padding-inline: 4px;
    overscroll-behavior-inline: contain;
  }
  .kanban__col {
    flex-basis: min(320px, calc(100vw - 40px));
    scroll-snap-align: start;
  }
  .kanban__toolbar .ui-btn {
    width: 100%;
  }
}
@media (pointer: coarse) {
  .kanban-card {
    cursor: pointer;
  }
}
`;
