import { buildLeadLifecycleEvents, buildLeadNotification } from "../../core/events.js";

export function buildCrmRecordBundle({ lead, actionLog, userId, deliveries = [] }) {
  if (!userId) throw new Error("userId is required to build CRM record bundle.");

  const tenantLead = { ...lead, userId };
  const tenantActionLog = { ...actionLog, userId };
  const notification = buildLeadNotification({
    userId,
    lead: tenantLead,
    actionLog: tenantActionLog,
  });
  const events = buildLeadLifecycleEvents({ userId, lead: tenantLead, actionLog: tenantActionLog });

  return {
    lead: tenantLead,
    action: tenantActionLog,
    notification,
    events,
    deliveries,
  };
}
