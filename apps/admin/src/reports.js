import { matchesSmartFilter } from "./work-queue.js";

const MS_DAY = 24 * 60 * 60 * 1000;

function leadTimestamp(lead) {
  const raw =
    lead.timestamp || lead.created_at || lead.createdAt || lead.updatedAt || lead.updated_at;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function withinDays(lead, days, nowMs) {
  const t = leadTimestamp(lead);
  if (!t) return days >= 999; // undated leads count only in "all"
  return nowMs - t <= days * MS_DAY;
}

/**
 * Build CRM report aggregates for the admin panel.
 * @param {Array} leads workspace leads (incl. demo if desired — filter before calling)
 * @param {{ now?: Date, days?: number }} options
 */
export function buildCrmReports(leads = [], { now = new Date(), days = 30 } = {}) {
  const list = Array.isArray(leads) ? leads.filter((lead) => !lead.demo) : [];
  const nowMs = now.getTime();
  const windowDays = Number(days) === 7 ? 7 : 30;
  const inWindow = list.filter((lead) => withinDays(lead, windowDays, nowMs));

  const bySource = new Map();
  for (const lead of inWindow) {
    const source = String(lead.source || "direct").trim() || "direct";
    bySource.set(source, (bySource.get(source) || 0) + 1);
  }
  const sources = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  const stages = ["new", "qualified", "contacted", "converted"];
  const funnel = stages.map((stage) => ({
    stage,
    count: inWindow.filter((lead) => (lead.status || lead.pipelineStage || "new") === stage).length,
  }));

  const byClass = {
    hot: inWindow.filter((l) => l.classification === "hot").length,
    warm: inWindow.filter((l) => l.classification === "warm").length,
    cold: inWindow.filter((l) => l.classification === "cold" || l.classification === "nurture")
      .length,
  };

  const staleHot = list.filter((lead) => matchesSmartFilter(lead, "stale_hot", now)).length;
  const dueToday = list.filter((lead) => matchesSmartFilter(lead, "due_today", now)).length;
  const noContact = list.filter((lead) => matchesSmartFilter(lead, "no_contact", now)).length;

  const maxSource = sources.reduce((max, row) => Math.max(max, row.count), 0) || 1;
  const maxFunnel = funnel.reduce((max, row) => Math.max(max, row.count), 0) || 1;

  return {
    days: windowDays,
    totals: {
      leads: inWindow.length,
      allTime: list.length,
      ...byClass,
      staleHot,
      dueToday,
      noContact,
    },
    sources: sources.map((row) => ({
      ...row,
      percent: Math.round((row.count / maxSource) * 100),
    })),
    funnel: funnel.map((row) => ({
      ...row,
      percent: Math.round((row.count / maxFunnel) * 100),
    })),
  };
}
