import { animateResolvedBars } from "../motion.js";

/**
 * Dense agency home — multi-panel command center from real dashboard payload.
 */

function money(n, currency = "USD") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function pct(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function stageLabel(s) {
  const map = {
    nuevo: "Nuevo",
    contactado: "Contactado",
    propuesta: "Propuesta",
    negociacion: "Negociación",
    ganado: "Ganado",
    perdido: "Perdido",
  };
  return map[s] || s;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {object} data — dashboardMetrics() enriched payload
 * @param {{ onNavigate?: (id: string) => void }} opts
 */
export function renderAgencyCommandCenter(data, { onNavigate } = {}) {
  const root = document.createElement("div");
  root.className = "acc stagger-in";

  // ── KPI strip (compact) ─────────────────────────────────────────────
  const kpis = document.createElement("section");
  kpis.className = "acc-kpis";
  kpis.setAttribute("aria-label", "KPIs");
  const kpiItems = [
    {
      label: "MRR",
      value: money(data.mrr),
      meta: pct(data.mrrDelta),
      tone: data.mrrDelta >= 0 ? "up" : "down",
      surfaceTone: data.mrrDelta >= 0 ? "success" : "danger",
    },
    {
      label: "Pipeline abierto",
      value: money(data.openPipeline),
      meta: `${data.openDealsCount || 0} deals`,
      tone: "neutral",
      surfaceTone: "accent",
    },
    {
      label: "Facturas abiertas",
      value: money(data.openInvoices),
      meta: `${data.openInvoicesCount || 0} docs`,
      tone: "down",
      surfaceTone: "warning",
    },
    {
      label: "Clientes activos",
      value: String(data.activeClients ?? 0),
      meta: `${data.activeProjects ?? 0} proyectos`,
      tone: "up",
      surfaceTone: "success",
    },
  ];
  for (const k of kpiItems) {
    const card = document.createElement("article");
    card.className = `acc-kpi acc-kpi--${k.surfaceTone}`;
    card.innerHTML = `
      <span class="acc-kpi__label">${escapeHtml(k.label)}</span>
      <strong class="acc-kpi__value">${escapeHtml(k.value)}</strong>
      <span class="acc-kpi__meta acc-kpi__meta--${k.tone}">${escapeHtml(k.meta)}</span>
    `;
    kpis.append(card);
  }
  root.append(kpis);

  // ── Main grid ───────────────────────────────────────────────────────
  const grid = document.createElement("div");
  grid.className = "acc-grid";

  // Left: pipeline stages + top deals
  const left = document.createElement("section");
  left.className = "acc-panel acc-panel--wide";
  left.innerHTML = `
    <header class="acc-panel__head">
      <div>
        <p class="acc-kicker">Pipeline</p>
        <h2 class="acc-panel__title">Embudo y deals prioritarios</h2>
      </div>
      <button type="button" class="acc-link" data-go="pipeline">Ver board →</button>
    </header>
  `;

  const stages = document.createElement("div");
  stages.className = "acc-stages";
  const openStages = (data.pipeline || []).filter((s) => !["ganado", "perdido"].includes(s.stage));
  if (!openStages.length) {
    stages.innerHTML = `<p class="acc-empty">Sin etapas con deals abiertos.</p>`;
  } else {
    const maxVal = Math.max(...openStages.map((s) => Number(s.total_value) || 0), 1);
    for (const s of openStages) {
      const w = Math.round((Number(s.total_value) / maxVal) * 100);
      const row = document.createElement("div");
      row.className = "acc-stage";
      row.innerHTML = `
        <div class="acc-stage__meta">
          <strong>${escapeHtml(stageLabel(s.stage))}</strong>
          <span>${Number(s.count) || 0} · ${money(s.total_value)}</span>
        </div>
        <div class="acc-stage__bar" role="presentation"><span style="width:${w}%"></span></div>
      `;
      stages.append(row);
    }
  }
  left.append(stages);

  const dealsTitle = document.createElement("h3");
  dealsTitle.className = "acc-subhead";
  dealsTitle.textContent = "Top deals abiertos";
  left.append(dealsTitle);

  const deals = document.createElement("div");
  deals.className = "acc-list";
  const top = data.topDeals || [];
  if (!top.length) {
    deals.innerHTML = `<p class="acc-empty">No hay deals abiertos.</p>`;
  } else {
    for (const d of top) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "acc-list__row";
      row.innerHTML = `
        <div class="acc-list__main">
          <strong>${escapeHtml(d.name)}</strong>
          <span>${escapeHtml(d.client_company || "Sin empresa")} · ${escapeHtml(stageLabel(d.stage))}</span>
        </div>
        <div class="acc-list__side">
          <strong>${money(d.value)}</strong>
          <span>${Number(d.probability) || 0}%</span>
        </div>
      `;
      row.addEventListener("click", () => {
        try {
          sessionStorage.setItem("crm:focusLead", String(d.id));
        } catch {
          /* ignore */
        }
        onNavigate?.("pipeline");
      });
      deals.append(row);
    }
  }
  left.append(deals);
  grid.append(left);

  // Right column: invoices + projects
  const right = document.createElement("div");
  right.className = "acc-col";

  const invPanel = document.createElement("section");
  invPanel.className = "acc-panel";
  invPanel.innerHTML = `
    <header class="acc-panel__head">
      <div>
        <p class="acc-kicker">Cobranza</p>
        <h2 class="acc-panel__title">Facturas en riesgo</h2>
      </div>
      <button type="button" class="acc-link" data-go="facturacion">Ver todas →</button>
    </header>
  `;
  const invList = document.createElement("div");
  invList.className = "acc-list";
  const invoices = data.invoicesAtRisk || [];
  if (!invoices.length) {
    invList.innerHTML = `<p class="acc-empty">Nada vencido ni pendiente de cobro.</p>`;
  } else {
    for (const inv of invoices) {
      const row = document.createElement("div");
      row.className = "acc-list__row acc-list__row--static";
      const risk = inv.status === "vencida" ? "risk" : "warn";
      row.innerHTML = `
        <div class="acc-list__main">
          <strong>${escapeHtml(inv.number)}</strong>
          <span>${escapeHtml(inv.client_company || "—")} · vence ${fmtDate(inv.due_date)}</span>
        </div>
        <div class="acc-list__side">
          <strong>${money(inv.amount, inv.currency)}</strong>
          <span class="acc-pill acc-pill--${risk}">${escapeHtml(inv.status)}</span>
        </div>
      `;
      invList.append(row);
    }
  }
  invPanel.append(invList);
  right.append(invPanel);

  const projPanel = document.createElement("section");
  projPanel.className = "acc-panel";
  projPanel.innerHTML = `
    <header class="acc-panel__head">
      <div>
        <p class="acc-kicker">Delivery</p>
        <h2 class="acc-panel__title">Proyectos activos</h2>
      </div>
      <button type="button" class="acc-link" data-go="proyectos">Ver todos →</button>
    </header>
  `;
  const projList = document.createElement("div");
  projList.className = "acc-list";
  const projects = data.projectsActive || [];
  if (!projects.length) {
    projList.innerHTML = `<p class="acc-empty">No hay proyectos activos.</p>`;
  } else {
    for (const p of projects) {
      const prog = Number(p.progress_percent) || 0;
      const row = document.createElement("div");
      row.className = "acc-list__row acc-list__row--static acc-list__row--stack";
      row.innerHTML = `
        <div class="acc-list__main">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${escapeHtml(p.client_company || "—")} · ${money(p.budget)}</span>
        </div>
        <div class="acc-progress">
          <div class="acc-progress__bar"><span style="width:${prog}%"></span></div>
          <span>${prog}%</span>
        </div>
      `;
      projList.append(row);
    }
  }
  projPanel.append(projList);
  right.append(projPanel);

  grid.append(right);
  root.append(grid);

  // ── Bottom: chart + recent ──────────────────────────────────────────
  const bottom = document.createElement("div");
  bottom.className = "acc-bottom";

  const chartPanel = document.createElement("section");
  chartPanel.className = "acc-panel";
  chartPanel.innerHTML = `<header class="acc-panel__head"><div><p class="acc-kicker">Tendencia</p><h2 class="acc-panel__title">MRR — 6 meses</h2></div></header>`;
  const snaps = data.snapshots || [];
  if (snaps.length) {
    const max = Math.max(...snaps.map((s) => Number(s.mrr) || 0), 1);
    const bars = document.createElement("div");
    bars.className = "acc-chart";
    for (const s of snaps) {
      const h = Math.max(6, Math.round((Number(s.mrr) / max) * 100));
      const label = new Date(s.month).toLocaleDateString("es-CO", { month: "short" });
      const col = document.createElement("div");
      col.className = "acc-chart__col";
      col.title = `${label}: ${money(s.mrr)}`;
      col.innerHTML = `<div class="acc-chart__bar" style="--bar-scale:${h / 100}"></div><span>${escapeHtml(label)}</span>`;
      bars.append(col);
    }
    chartPanel.append(bars);
  } else {
    chartPanel.append(
      Object.assign(document.createElement("p"), {
        className: "acc-empty",
        textContent: "Sin snapshots de MRR.",
      }),
    );
  }
  bottom.append(chartPanel);

  const recentPanel = document.createElement("section");
  recentPanel.className = "acc-panel";
  recentPanel.innerHTML = `<header class="acc-panel__head"><div><p class="acc-kicker">Actividad</p><h2 class="acc-panel__title">Deals recientes</h2></div></header>`;
  const recentList = document.createElement("div");
  recentList.className = "acc-list";
  const recent = data.recentLeads || [];
  if (!recent.length) {
    recentList.innerHTML = `<p class="acc-empty">Sin actividad reciente.</p>`;
  } else {
    for (const r of recent) {
      const row = document.createElement("div");
      row.className = "acc-list__row acc-list__row--static";
      row.innerHTML = `
        <div class="acc-list__main">
          <strong>${escapeHtml(r.name)}</strong>
          <span>${escapeHtml(r.client_company || "—")} · ${escapeHtml(stageLabel(r.stage))}</span>
        </div>
        <div class="acc-list__side">
          <strong>${money(r.value)}</strong>
          <span>${fmtDate(r.updated_at)}</span>
        </div>
      `;
      recentList.append(row);
    }
  }
  recentPanel.append(recentList);
  bottom.append(recentPanel);

  root.append(bottom);

  root.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => onNavigate?.(btn.getAttribute("data-go")));
  });

  animateResolvedBars(root, ".acc-chart__bar", {
    axis: "y",
    variable: "--bar-scale",
  });
  return root;
}

export const agencyCommandCenterStyles = `
.acc {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.acc-kicker {
  margin: 0 0 2px;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-mute);
}
.acc-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.acc-kpi {
  --acc-tone: var(--color-accent);
  --acc-tone-soft: var(--color-accent-soft);
  position: relative;
  padding: 10px 12px 10px 14px;
  border: 1px solid color-mix(in srgb, var(--acc-tone) 20%, var(--color-border));
  border-radius: var(--radius-panel, 10px);
  background: color-mix(in srgb, var(--acc-tone-soft) 72%, var(--color-surface));
  overflow: hidden;
  min-height: 72px;
}
.acc-kpi--success {
  --acc-tone: var(--color-success);
  --acc-tone-soft: var(--color-success-soft);
}
.acc-kpi--warning {
  --acc-tone: var(--color-warning);
  --acc-tone-soft: var(--color-warning-soft);
}
.acc-kpi--danger {
  --acc-tone: var(--color-danger);
  --acc-tone-soft: var(--color-danger-soft);
}
.acc-kpi::before {
  content: none;
}
.acc-kpi__label {
  display: block;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--acc-tone);
}
.acc-kpi__value {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.acc-kpi__meta {
  display: block;
  margin-top: 4px;
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--color-text-2);
}
.acc-kpi__meta--up { color: var(--color-success); }
.acc-kpi__meta--down { color: var(--color-danger); }

.acc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  gap: 10px;
  align-items: start;
}
.acc-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.acc-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.acc-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel, 10px);
  background: var(--color-surface);
  padding: 12px 14px;
  min-width: 0;
}
.acc-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.acc-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.acc-link {
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  white-space: nowrap;
}
.acc-link:hover { text-decoration: underline; }
.acc-subhead {
  margin: 12px 0 6px;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-mute);
}
.acc-empty {
  margin: 0;
  padding: 16px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--color-mute);
  border: 1px dashed var(--color-border-strong, var(--color-border));
  border-radius: 8px;
}

.acc-stages { display: flex; flex-direction: column; gap: 8px; }
.acc-stage__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}
.acc-stage__meta strong { font-weight: 600; color: var(--color-text); }
.acc-stage__meta span { color: var(--color-text-2); font-variant-numeric: tabular-nums; }
.acc-stage__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--color-surface-deep, var(--color-surface-2));
  overflow: hidden;
}
.acc-stage__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
}

.acc-list { display: flex; flex-direction: column; gap: 4px; }
.acc-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-2, var(--color-surface-deep));
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: border-color 120ms var(--ease-out), transform 120ms var(--ease-out);
}
.acc-list__row--static { cursor: default; }
.acc-list__row--stack { flex-direction: column; align-items: stretch; }
.acc-list__row:not(.acc-list__row--static):hover {
  border-color: var(--color-border-strong, var(--color-border-control));
  transform: translateY(-1px);
}
.acc-list__main { min-width: 0; display: grid; gap: 1px; }
.acc-list__main strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acc-list__main span {
  font-size: var(--text-meta);
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acc-list__side {
  flex-shrink: 0;
  text-align: right;
  display: grid;
  gap: 2px;
}
.acc-list__side strong {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}
.acc-list__side span {
  font-size: var(--text-caption);
  color: var(--color-mute);
}
.acc-pill {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: var(--text-caption) !important;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.acc-pill--risk {
  background: var(--color-danger-soft);
  color: var(--color-danger) !important;
}
.acc-pill--warn {
  background: var(--color-warning-soft);
  color: var(--color-warning) !important;
}
.acc-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.acc-progress__bar {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: var(--color-surface-deep, #eee);
  overflow: hidden;
}
.acc-progress__bar span {
  display: block;
  height: 100%;
  background: var(--color-accent);
  border-radius: inherit;
}
.acc-progress > span {
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
}

.acc-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 110px;
  padding-top: 4px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}
.acc-chart__col {
  flex: 1;
  min-width: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 4px;
}
.acc-chart__bar {
  width: 100%;
  height: 100%;
  max-width: 36px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: linear-gradient(180deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 35%, transparent));
  transform: scaleY(var(--bar-scale, 0));
  transform-origin: bottom;
}
.acc-chart__col span {
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-mute);
}

@media (max-width: 1100px) {
  .acc-grid, .acc-bottom { grid-template-columns: 1fr; }
  .acc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .acc-kpis { grid-template-columns: 1fr 1fr; }
  .acc-kpi__value { font-size: var(--text-title-lg); }
  .acc-panel__head {
    flex-wrap: wrap;
  }
  .acc-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .acc-list__row {
    min-height: 44px;
  }
  .acc-list__main strong,
  .acc-list__main span {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
@media (max-width: 480px) {
  .acc-kpis {
    grid-template-columns: 1fr;
  }
  .acc-list__row {
    align-items: flex-start;
  }
}
`;
