import { getAutomationEnv } from "../../config/env.js";
import { deliverQueuedAutomationActions } from "./automation-delivery-service.js";

let timer = null;
let stopped = true;
let running = false;

function schedule(delayMs) {
  if (stopped || timer) return;
  timer = setTimeout(runOnce, delayMs);
  timer.unref?.();
}

async function runOnce() {
  timer = null;
  if (stopped || running) return;
  running = true;
  const config = getAutomationEnv();
  try {
    const results = await deliverQueuedAutomationActions({
      limit: config.deliveryWorkerBatchSize,
    });
    const delivered = results.filter((result) => result.status === "sent").length;
    if (delivered) {
      console.info("[Luenio Automation] Queued deliveries sent", { count: delivered });
    }
  } catch {
    console.warn("[Luenio Automation] Delivery queue retry deferred");
  } finally {
    running = false;
    schedule(config.deliveryWorkerIntervalMs);
  }
}

function hasAnyConfiguredTarget(config) {
  return Boolean(
    config.webhookUrl || config.crmWebhookUrl || config.whatsappWebhookUrl || config.emailWebhookUrl,
  );
}

export function startAutomationDeliveryWorker() {
  const config = getAutomationEnv();
  if (!config.deliveryWorkerEnabled || !hasAnyConfiguredTarget(config) || stopped === false) return;
  stopped = false;
  schedule(config.deliveryWorkerIntervalMs);
}

export function stopAutomationDeliveryWorker() {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
