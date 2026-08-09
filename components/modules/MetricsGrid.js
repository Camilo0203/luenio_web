import { animateResolvedBars } from "../motion.js";

/**
 * Bento metrics grid — consumes real dashboardMetrics() data only.
 */

function formatMoney(n, currency = "USD") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function formatPct(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/**
 * @param {{ metrics: Awaited<ReturnType<import('../../lib/db/queries.js').dashboardMetrics>> }} props
 */
export function renderMetricsGrid(metrics) {
  const root = document.createElement("section");
  root.className = "metrics-grid bento-grid stagger-in";
  root.setAttribute("aria-label", "Métricas principales");

  const cards = [
    {
      key: "mrr",
      label: "MRR",
      value: formatMoney(metrics.mrr),
      delta: formatPct(metrics.mrrDelta),
      positive: metrics.mrrDelta >= 0,
      span: "bento-span-3",
    },
    {
      key: "new",
      label: "New MRR",
      value: formatMoney(metrics.newMrr),
      delta: "este mes",
      positive: true,
      span: "bento-span-3",
    },
    {
      key: "churn",
      label: "Churned MRR",
      value: formatMoney(metrics.churnedMrr),
      delta: "pérdida",
      positive: false,
      span: "bento-span-3",
    },
    {
      key: "clients",
      label: "Clientes activos",
      value: String(metrics.activeClients ?? 0),
      delta: `${metrics.activeProjects ?? 0} proyectos`,
      positive: true,
      span: "bento-span-3",
    },
    {
      key: "pipeline",
      label: "Pipeline abierto",
      value: formatMoney(metrics.openPipeline),
      delta: "valor ponderable",
      positive: true,
      span: "bento-span-6",
    },
    {
      key: "invoices",
      label: "Facturas abiertas",
      value: formatMoney(metrics.openInvoices),
      delta: "enviadas + vencidas",
      positive: false,
      span: "bento-span-6",
    },
  ];

  for (const c of cards) {
    const card = document.createElement("article");
    card.className = `metric-card metric-card--${c.key} ui-surface ui-surface--card ui-surface--interactive ${c.span}`;
    card.innerHTML = `
      <div class="metric-card__accent" aria-hidden="true"></div>
      <div class="metric-card__body">
        <div class="metric-card__label">${c.label}</div>
        <div class="metric-card__value">${c.value}</div>
        <div class="metric-card__delta ${c.positive ? "is-up" : "is-down"}">${c.delta}</div>
      </div>
    `;
    root.append(card);
  }

  // MRR sparkline strip from snapshots
  if (metrics.snapshots?.length) {
    const chart = document.createElement("article");
    chart.className = "metric-chart ui-surface ui-surface--panel bento-span-12";
    const max = Math.max(...metrics.snapshots.map((s) => Number(s.mrr) || 0), 1);
    const bars = metrics.snapshots
      .map((s) => {
        const h = Math.round((Number(s.mrr) / max) * 100);
        const label = new Date(s.month).toLocaleDateString("es-CO", { month: "short" });
        return `<div class="metric-chart__col" title="${label}: ${formatMoney(s.mrr)}">
          <div class="metric-chart__bar" style="--bar-scale:${h / 100}"></div>
          <span class="metric-chart__lbl">${label}</span>
        </div>`;
      })
      .join("");
    chart.innerHTML = `
      <div class="metric-chart__head">
        <span class="metric-card__label">MRR — últimos meses</span>
      </div>
      <div class="metric-chart__bars">${bars}</div>
    `;
    root.append(chart);
  }

  animateResolvedBars(root, ".metric-chart__bar", {
    axis: "y",
    variable: "--bar-scale",
  });
  return root;
}

export const metricsGridStyles = `
.metrics-grid {
  width: 100%;
  min-width: 0;
  margin-bottom: var(--space-4);
}
.metric-card {
  --metric-tone: var(--color-accent);
  --metric-tone-soft: var(--color-accent-soft);
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 72px;
  border-color: color-mix(in srgb, var(--metric-tone) 20%, var(--color-border));
  background: color-mix(in srgb, var(--metric-tone-soft) 72%, var(--color-surface));
}
.metric-card--new,
.metric-card--clients {
  --metric-tone: var(--color-success);
  --metric-tone-soft: var(--color-success-soft);
}
.metric-card--churn {
  --metric-tone: var(--color-danger);
  --metric-tone-soft: var(--color-danger-soft);
}
.metric-card--invoices {
  --metric-tone: var(--color-warning);
  --metric-tone-soft: var(--color-warning-soft);
}
.metric-card__accent {
  display: none;
}
.metric-card__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.metric-card__label {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--metric-tone);
}
.metric-card__value {
  font-size: var(--text-kpi);
  font-weight: var(--font-weight-bold);
  line-height: 1.15;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.metric-card__delta {
  font-size: var(--text-meta);
  color: var(--color-text-2);
}
.metric-card__delta.is-up { color: var(--color-success); }
.metric-card__delta.is-down { color: var(--color-danger); }
.metric-chart {
  padding: 14px;
}
.metric-chart__head { margin-bottom: 12px; }
.metric-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 120px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}
.metric-chart__col {
  flex: 1;
  min-width: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 6px;
}
.metric-chart__bar {
  width: 100%;
  height: 100%;
  max-width: 48px;
  min-height: 4px;
  border-radius: var(--radius-control) var(--radius-control) 0 0;
  background: linear-gradient(180deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 35%, transparent) 100%);
  transform: scaleY(var(--bar-scale, 0));
  transform-origin: bottom;
  transition: transform var(--duration-normal) var(--ease-out);
}
.metric-chart__lbl {
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-mute);
}
@media (max-width: 480px) {
  .metric-chart {
    padding-inline: 12px;
  }
  .metric-chart__bars {
    gap: 8px;
  }
}
`;
