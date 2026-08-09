import { createBadge, toneForStatus } from "../ui/Badge.js";
import { createEmptyState } from "../ui/EmptyState.js";

function money(n, currency = "USD") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * @param {{ invoices: any[], onSelect?: (inv: any) => void }} opts
 */
export function renderInvoiceList({ invoices = [], onSelect } = {}) {
  const root = document.createElement("section");
  root.className = "invoice-list";
  root.setAttribute("aria-label", "Listado de facturas");

  if (!invoices.length) {
    root.append(
      createEmptyState({
        title: "Sin facturas",
        description:
          "Cuando haya facturas en Neon, aparecerán aquí. Emisión de facturas: vía seed/API por ahora.",
      }),
    );
    return root;
  }

  const table = document.createElement("table");
  table.className = "data-table ui-surface ui-surface--panel";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Número</th>
        <th>Cliente</th>
        <th>Proyecto</th>
        <th>Monto</th>
        <th>Estado</th>
        <th>Emisión</th>
        <th>Vence</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  tbody.className = "stagger-in";

  for (const inv of invoices) {
    const tr = document.createElement("tr");
    if (onSelect) {
      tr.tabIndex = 0;
      tr.dataset.interactive = "true";
      tr.addEventListener("click", () => onSelect(inv));
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(inv);
        }
      });
    }
    tr.innerHTML = `
      <td data-label="Número"><strong>${escapeHtml(inv.number)}</strong></td>
      <td data-label="Cliente">${escapeHtml(inv.client_company || inv.client_name || "—")}</td>
      <td data-label="Proyecto">${escapeHtml(inv.project_name || "—")}</td>
      <td data-label="Monto" class="tabular">${money(inv.amount, inv.currency)}</td>
      <td data-label="Estado" data-badge></td>
      <td data-label="Emisión">${fmtDate(inv.issue_date)}</td>
      <td data-label="Vence">${fmtDate(inv.due_date)}</td>
    `;
    tr.querySelector("[data-badge]").append(
      createBadge({ label: inv.status, tone: toneForStatus(inv.status) }),
    );
    tbody.append(tr);
  }

  table.append(tbody);
  root.append(table);
  return root;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const invoiceListStyles = `
.invoice-list {
  width: 100%;
  min-width: 0;
}
.invoice-list .tabular {
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}
`;
