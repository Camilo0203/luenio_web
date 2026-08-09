import { createBadge, toneForStatus } from "../ui/Badge.js";
import { createEmptyState } from "../ui/EmptyState.js";
import { createInput } from "../ui/Input.js";

/**
 * @param {{
 *   clients: any[],
 *   total?: number,
 *   onSearch?: (q: string) => void,
 *   onSelect?: (client: any) => void,
 *   onPage?: (dir: 'prev'|'next') => void,
 *   page?: number,
 *   pageSize?: number
 * }} opts
 */
export function renderClientTable({
  clients = [],
  total = 0,
  onSearch,
  onSelect,
  onPage,
  page = 0,
  pageSize = 25,
} = {}) {
  const root = document.createElement("section");
  root.className = "client-table";
  root.setAttribute("aria-label", "Tabla de clientes");

  const toolbar = document.createElement("div");
  toolbar.className = "client-table__toolbar";
  const search = createInput({
    placeholder: "Buscar por nombre, empresa o email…",
    ariaLabel: "Buscar clientes",
    name: "client-search",
    onInput: (e) => onSearch?.(e.target.value),
  });
  search.classList.add("client-table__search");
  toolbar.append(search);

  root.append(toolbar);

  if (!clients.length) {
    root.append(
      createEmptyState({
        title: "No hay clientes",
        description:
          "Ajusta la búsqueda o carga el seed de Neon. La creación de clientes se gestiona vía API/DB por ahora.",
      }),
    );
    return root;
  }

  const table = document.createElement("table");
  table.className = "data-table ui-surface ui-surface--panel";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Empresa</th>
        <th>Email</th>
        <th>Estado</th>
        <th>Owner</th>
        <th>Tags</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  tbody.className = "stagger-in";

  for (const c of clients) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.interactive = "true";
    tr.addEventListener("click", () => onSelect?.(c));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(c);
      }
    });

    const nameTd = document.createElement("td");
    nameTd.dataset.label = "Cliente";
    nameTd.innerHTML = `<strong>${escapeHtml(c.name)}</strong>`;

    const companyTd = document.createElement("td");
    companyTd.dataset.label = "Empresa";
    companyTd.textContent = c.company;

    const emailTd = document.createElement("td");
    emailTd.dataset.label = "Email";
    emailTd.textContent = c.email;

    const statusTd = document.createElement("td");
    statusTd.dataset.label = "Estado";
    statusTd.append(createBadge({ label: c.status, tone: toneForStatus(c.status) }));

    const ownerTd = document.createElement("td");
    ownerTd.dataset.label = "Owner";
    ownerTd.textContent = c.owner_name || "—";

    const tagsTd = document.createElement("td");
    tagsTd.dataset.label = "Tags";
    tagsTd.className = "data-table__tags";
    const tagList = document.createElement("span");
    tagList.className = "data-table__tag-list";
    (c.tags || []).slice(0, 3).forEach((t) => {
      tagList.append(createBadge({ label: t, tone: "cold" }));
    });
    tagsTd.append(tagList);

    tr.append(nameTd, companyTd, emailTd, statusTd, ownerTd, tagsTd);
    tbody.append(tr);
  }

  table.append(tbody);
  root.append(table);

  const footer = document.createElement("div");
  footer.className = "client-table__footer";
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  footer.innerHTML = `<span>${from}–${to} de ${total}</span>`;
  const pager = document.createElement("div");
  pager.className = "client-table__pager";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "ui-btn ui-btn--secondary ui-btn--sm";
  prev.textContent = "Anterior";
  prev.disabled = page <= 0;
  prev.addEventListener("click", () => onPage?.("prev"));
  const next = document.createElement("button");
  next.type = "button";
  next.className = "ui-btn ui-btn--secondary ui-btn--sm";
  next.textContent = "Siguiente";
  next.disabled = (page + 1) * pageSize >= total;
  next.addEventListener("click", () => onPage?.("next"));
  pager.append(prev, next);
  footer.append(pager);
  root.append(footer);

  return root;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const clientTableStyles = `
.client-table {
  width: 100%;
  min-width: 0;
}
.client-table__toolbar {
  margin-bottom: 8px;
}
.client-table__search { max-width: 360px; }
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}
.data-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-mute);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-table td {
  padding: 8px 10px;
  font-size: var(--text-body-md);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.data-table td :is(strong, span) { overflow-wrap: anywhere; }
.data-table tbody tr {
  height: 42px;
}
.data-table tbody tr[data-interactive] {
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.data-table tbody tr[data-interactive]:hover {
  background: var(--color-surface-2);
}
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table__tags {
  min-width: 120px;
}
.data-table__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.client-table__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: var(--text-meta);
  color: var(--color-text-2);
}
.client-table__pager { display: flex; gap: 8px; }
@media (max-width: 640px) {
  .client-table__search {
    max-width: none;
  }
  .data-table {
    display: block;
    overflow: visible;
    border: 0;
    background: transparent;
  }
  .data-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .data-table tbody {
    display: grid;
    gap: 8px;
  }
  .data-table tbody tr {
    display: block;
    height: auto;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
  }
  .data-table td {
    display: grid;
    grid-template-columns: minmax(68px, 0.65fr) minmax(0, 1.35fr);
    gap: 12px;
    padding: 6px 0;
    border: 0;
    text-align: left;
  }
  .data-table td::before {
    content: attr(data-label);
    font-size: var(--text-caption);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-mute);
  }
  .data-table td:first-child {
    display: block;
    padding: 2px 0 10px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-title);
  }
  .data-table td:first-child::before {
    content: none;
  }
  .data-table__tags {
    min-width: 0;
  }
  .client-table__footer {
    align-items: stretch;
  }
}
@media (max-width: 400px) {
  .client-table__footer {
    flex-direction: column;
    gap: 8px;
  }
  .client-table__pager .ui-btn {
    flex: 1;
  }
}
`;
