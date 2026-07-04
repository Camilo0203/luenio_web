import { buildAutomationPlan, buildWorkflow } from "../../core/engine.js";
import { filterActionsByPlan } from "../../config/billing.js";
import { getAutomationEnv } from "../../config/env.js";

const integrationTargets = {
  send_webhook: {
    label: "webhook",
    configKey: "webhookUrl",
  },
  send_crm_webhook: {
    label: "crm_webhook",
    configKey: "crmWebhookUrl",
  },
  send_whatsapp_notification: {
    label: "whatsapp_notification",
    configKey: "whatsappWebhookUrl",
  },
  send_email_notification: {
    label: "email_notification",
    configKey: "emailWebhookUrl",
  },
};

async function sendIntegration(url, payload, label) {
  if (!url) {
    return {
      label,
      status: "not_configured",
      message: "Configure the environment variable to send this action externally.",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      label,
      status: response.ok ? "sent" : "failed",
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      label,
      status: "failed",
      message: "Integration delivery failed.",
    };
  }
}

export async function runAutomationEngine(lead, options = {}) {
  const workflow = buildWorkflow(lead);
  const allowedActions = filterActionsByPlan(options.plan || "starter", workflow.actions);
  const plan = buildAutomationPlan(lead, { allowedActions });
  const integrationResults = [];
  const automation = getAutomationEnv();

  for (const action of plan.actions) {
    const target = integrationTargets[action];
    if (!target) continue;
    integrationResults.push(
      await sendIntegration(automation[target.configKey], plan.payload, target.label),
    );
  }

  return {
    ...plan,
    integrationResults,
  };
}
