const STALE_HOT_MS = 48 * 60 * 60 * 1000;

function classificationOf(lead) {
  return (
    lead.classification ||
    (Number(lead.score) >= 80 ? "hot" : Number(lead.score) >= 60 ? "warm" : "cold")
  );
}

function statusOf(lead) {
  return lead.status || lead.pipelineStage || lead.pipeline_stage || "new";
}

function nextActionAtOf(lead) {
  return lead.nextActionAt || lead.next_action_at || null;
}

function lastContactedOf(lead) {
  return lead.lastContactedAt || lead.last_contacted_at || null;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function matchesSmartFilter(lead, smartFilter, now = new Date(), options = {}) {
  if (!smartFilter || smartFilter === "all") return true;
  const nowMs = now.getTime();
  const status = statusOf(lead);
  const nextAt = nextActionAtOf(lead);
  const lastContact = lastContactedOf(lead);
  const currentUserId = options.currentUserId || null;

  if (smartFilter === "due_today") {
    if (!nextAt || status === "converted") return false;
    const t = new Date(nextAt).getTime();
    if (!Number.isFinite(t)) return false;
    return startOfDay(new Date(t)) === startOfDay(now) || t <= nowMs;
  }

  if (smartFilter === "needs_followup") {
    if (status === "converted") return false;
    if (lead.nextAction || lead.next_action) return true;
    if (!nextAt) return false;
    const t = new Date(nextAt).getTime();
    return Number.isFinite(t) && t <= nowMs;
  }

  if (smartFilter === "stale_hot") {
    if (classificationOf(lead) !== "hot" || status === "converted") return false;
    if (!lastContact) return true;
    const t = new Date(lastContact).getTime();
    if (!Number.isFinite(t)) return true;
    return nowMs - t >= STALE_HOT_MS;
  }

  if (smartFilter === "no_contact") {
    if (lead.demo) return false;
    return !lastContact && status !== "converted";
  }

  if (smartFilter === "mine") {
    const assignee = lead.assigneeUserId || lead.assignee_user_id || null;
    if (!currentUserId) return false;
    return assignee === currentUserId;
  }

  if (smartFilter === "unassigned") {
    const assignee = lead.assigneeUserId || lead.assignee_user_id || null;
    return !assignee && status !== "converted";
  }

  return true;
}

/**
 * Rank leads for today's work queue.
 * Priority: overdue/due → stale hot → no contact → others with next action.
 */
export function buildWorkQueue(leads = [], { now = new Date(), limit = 5 } = {}) {
  const nowMs = now.getTime();

  const scored = leads
    .filter((lead) => statusOf(lead) !== "converted")
    .map((lead) => {
      let priority = 100;
      const nextAt = nextActionAtOf(lead);
      const nextMs = nextAt ? new Date(nextAt).getTime() : NaN;
      if (Number.isFinite(nextMs) && nextMs <= nowMs) priority = 1;
      else if (Number.isFinite(nextMs) && startOfDay(new Date(nextMs)) === startOfDay(now))
        priority = 2;
      else if (matchesSmartFilter(lead, "stale_hot", now)) priority = 3;
      else if (matchesSmartFilter(lead, "no_contact", now)) priority = 4;
      else if (lead.nextAction || lead.next_action) priority = 5;
      else priority = 50;

      return {
        lead,
        priority,
        nextMs: Number.isFinite(nextMs) ? nextMs : Number.POSITIVE_INFINITY,
      };
    })
    .filter((item) => item.priority < 50)
    .sort((a, b) => a.priority - b.priority || a.nextMs - b.nextMs);

  return scored.slice(0, limit).map((item) => item.lead);
}
