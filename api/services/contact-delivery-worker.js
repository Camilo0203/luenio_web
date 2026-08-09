import { getContactEnv } from "../../config/env.js";
import { deliverQueuedContactInquiries } from "./contact-service.js";

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
  const config = getContactEnv();
  try {
    const results = await deliverQueuedContactInquiries({
      limit: config.deliveryWorkerBatchSize,
    });
    const delivered = results.filter((result) => result.status === "sent").length;
    if (delivered) {
      console.info("[Luenio Contact] Queued notifications delivered", { count: delivered });
    }
  } catch {
    console.warn("[Luenio Contact] Delivery queue retry deferred");
  } finally {
    running = false;
    schedule(config.deliveryWorkerIntervalMs);
  }
}

export function startContactDeliveryWorker() {
  const config = getContactEnv();
  if (!config.deliveryWorkerEnabled || !config.webhookUrl || stopped === false) return;
  stopped = false;
  schedule(config.deliveryWorkerIntervalMs);
}

export function stopContactDeliveryWorker() {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
