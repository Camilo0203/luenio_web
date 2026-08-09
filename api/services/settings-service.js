import { getPlan } from "../../config/billing.js";

export function buildWorkspaceChecklist({ user }) {
  const plan = getPlan(user.plan);
  return [
    {
      id: "auth",
      label: "Workspace secured",
      done: true,
      description: "Session-based auth is active for this workspace.",
    },
    {
      id: "limits",
      label: `${plan.name} limits active`,
      done: true,
      description: `${plan.monthlyLeadLimit.toLocaleString()} leads/month with ${plan.features.join(", ")}.`,
    },
  ];
}

export function getWorkspaceSettings(user) {
  const plan = getPlan(user.plan);

  return {
    user,
    plan: {
      name: plan.name,
      monthlyLeadLimit: plan.monthlyLeadLimit,
      features: plan.features,
    },
    checklist: buildWorkspaceChecklist({ user }),
  };
}
