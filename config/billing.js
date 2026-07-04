export const plans = {
  starter: {
    name: "Starter",
    monthlyLeadLimit: 100,
    features: ["crm", "lead_scoring", "email_notifications"],
    stripePriceEnv: "STRIPE_STARTER_PRICE_ID",
  },
  pro: {
    name: "Pro",
    monthlyLeadLimit: 1000,
    features: ["crm", "lead_scoring", "email_notifications", "whatsapp_notifications", "webhooks"],
    stripePriceEnv: "STRIPE_PRO_PRICE_ID",
  },
  agency: {
    name: "Agency",
    monthlyLeadLimit: 10000,
    features: ["crm", "lead_scoring", "email_notifications", "whatsapp_notifications", "webhooks", "multi_workspace"],
    stripePriceEnv: "STRIPE_AGENCY_PRICE_ID",
  },
};

export function getPlan(planId = "starter") {
  return plans[planId] || plans.starter;
}

export function isValidPlan(planId) {
  return Boolean(plans[planId]);
}

export function getCurrentBillingPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function countLeadsInBillingPeriod(leads = [], period = getCurrentBillingPeriod()) {
  const start = new Date(period.start).getTime();
  const end = new Date(period.end).getTime();

  return leads.filter((lead) => {
    const timestamp = lead.created_at || lead.createdAt || lead.timestamp || lead.updated_at || lead.updatedAt;
    const time = timestamp ? new Date(timestamp).getTime() : 0;
    return Number.isFinite(time) && time >= start && time < end;
  }).length;
}

export function getLeadUsage(user, leads = [], now = new Date()) {
  const plan = getPlan(user?.plan);
  const period = getCurrentBillingPeriod(now);
  const used = countLeadsInBillingPeriod(leads, period);
  const remaining = Math.max(plan.monthlyLeadLimit - used, 0);
  return {
    plan: user?.plan || "starter",
    limit: plan.monthlyLeadLimit,
    used,
    remaining,
    period,
    percentUsed: Math.min(Math.round((used / plan.monthlyLeadLimit) * 100), 100),
  };
}

export function assertLeadLimit(user, leadsOrCurrentLeadCount) {
  const plan = getPlan(user?.plan);
  const currentLeadCount = Array.isArray(leadsOrCurrentLeadCount)
    ? getLeadUsage(user, leadsOrCurrentLeadCount).used
    : Number(leadsOrCurrentLeadCount || 0);

  if (currentLeadCount >= plan.monthlyLeadLimit) {
    const error = new Error(`Lead limit reached for ${plan.name}. Upgrade your plan to continue.`);
    error.statusCode = 402;
    error.usage = {
      used: currentLeadCount,
      limit: plan.monthlyLeadLimit,
      plan: user?.plan || "starter",
    };
    throw error;
  }
  return true;
}

export function filterActionsByPlan(planId, actions) {
  const plan = getPlan(planId);
  return actions.filter((action) => {
    if (action === "send_whatsapp_notification") return plan.features.includes("whatsapp_notifications");
    if (action === "send_webhook" || action === "send_crm_webhook") return plan.features.includes("webhooks");
    return true;
  });
}
