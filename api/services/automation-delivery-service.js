import { getAutomationEnv } from "../../config/env.js";
import { claimAutomationDeliveries, completeAutomationDelivery } from "../../db/storage.js";
import { deliverWebhook } from "./webhook-delivery.js";
import { integrationTargets } from "./automation-service.js";

function shapeDeliveryResult(label, result) {
  if (result.reason === "missing_token") {
    return {
      label,
      status: "failed",
      message: "Authenticated integration delivery is not configured.",
    };
  }
  if (result.reason === "network_error") {
    return {
      label,
      status: "failed",
      message: "Integration delivery failed.",
    };
  }
  return {
    label,
    status: result.status,
    httpStatus: result.httpStatus,
  };
}

/**
 * Drains queued automation_deliveries rows: claims, sends via the shared
 * webhook-delivery primitive (re-resolving the target URL/token from live
 * config on every attempt, never from the persisted row), and completes.
 * Used both for the best-effort immediate attempt right after a lead is
 * captured (limit scoped to that lead's own rows) and by
 * automation-delivery-worker.js for background retries (unscoped, batched).
 */
export async function deliverQueuedAutomationActions({ limit = 10, leadId = null } = {}) {
  const claims = await claimAutomationDeliveries({ limit, leadId });
  const automation = getAutomationEnv();
  const results = [];

  for (const claim of claims) {
    const target = integrationTargets[claim.action];
    const label = target?.label || claim.action;
    const url = target ? automation[target.configKey] : null;

    const delivery = await deliverWebhook({
      url,
      token: automation.webhookToken,
      payload: claim.payload,
      urlLabel: `${label} URL`,
    });

    await completeAutomationDelivery({
      deliveryId: claim.deliveryId,
      succeeded: delivery.status === "sent",
      httpStatus: delivery.httpStatus || null,
    });

    results.push(shapeDeliveryResult(label, delivery));
  }

  return results;
}
