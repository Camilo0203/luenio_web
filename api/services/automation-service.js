import { buildAutomationPlan, buildWorkflow } from "../../core/engine.js";
import { filterActionsByPlan } from "../../config/billing.js";
import { getAutomationEnv } from "../../config/env.js";

export const integrationTargets = {
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

/**
 * Builds the automation plan (pure) and classifies each send_* action:
 * configured actions become queued deliveries (persisted by the caller,
 * delivered later by automation-delivery-service.js); actions with no
 * destination stay "not_configured" and are never queued, matching the
 * pre-queue behavior of never attempting a send with nothing to send to.
 *
 * Does no network I/O. The returned `plan.integrationResults` is a
 * queued-at-plan-time snapshot for what gets persisted immediately -- the
 * caller replaces it with the real outcome after the immediate delivery
 * attempt (see lead-capture-service.js), the same way contact_inquiries
 * never reflects contact_deliveries' final status.
 */
export function buildAutomationDeliveryPlan(lead, options = {}) {
  const workflow = buildWorkflow(lead);
  const allowedActions = filterActionsByPlan(options.plan || "starter", workflow.actions);
  const plan = buildAutomationPlan(lead, { allowedActions });
  const automation = getAutomationEnv();

  const queuedIntegrationResults = [];
  const deliveries = [];
  for (const action of plan.actions) {
    const target = integrationTargets[action];
    if (!target) continue;
    const url = automation[target.configKey];
    if (!url) {
      queuedIntegrationResults.push({
        label: target.label,
        status: "not_configured",
        message: "Configure the environment variable to send this action externally.",
      });
      continue;
    }
    queuedIntegrationResults.push({ label: target.label, status: "queued" });
    deliveries.push({ action, label: target.label, payload: plan.payload });
  }

  return {
    plan: { ...plan, integrationResults: queuedIntegrationResults },
    deliveries,
  };
}
