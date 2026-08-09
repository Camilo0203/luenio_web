import { getDigestEnv, isDigestDeliveryConfigured } from "../../config/env.js";
import { deliverWorkspaceDigests } from "./digest-service.js";
import { logInfo, logError } from "./logger.js";

let timer = null;
let stopped = true;
let running = false;
/** @type {Map<string, number>} workspaceId -> last successful send (ms) */
const lastSentAtByWorkspace = new Map();

function schedule(delayMs) {
  if (stopped || timer) return;
  timer = setTimeout(runOnce, delayMs);
  timer.unref?.();
}

async function runOnce() {
  timer = null;
  if (stopped || running) return;
  running = true;
  const config = getDigestEnv();
  try {
    if (!isDigestDeliveryConfigured(config)) {
      return;
    }
    const result = await deliverWorkspaceDigests({
      lastSentAtByWorkspace,
      now: new Date(),
    });
    if (result.sent > 0) {
      logInfo("digest.worker.sent", {
        sent: result.sent,
        skipped: result.skipped,
        workspaces: result.workspaceCount,
      });
    }
  } catch (error) {
    logError("digest.worker.failed", {
      message: error?.message ? String(error.message).slice(0, 120) : "unknown",
    });
  } finally {
    running = false;
    schedule(config.workerIntervalMs || 60 * 60 * 1000);
  }
}

export function startDigestDeliveryWorker() {
  const config = getDigestEnv();
  if (!isDigestDeliveryConfigured(config) || stopped === false) return;
  stopped = false;
  logInfo("digest.worker.started", {
    intervalMs: config.workerIntervalMs,
    minHoursBetween: config.minHoursBetweenSends,
  });
  // First tick after a short delay so boot is not blocked by outbound webhooks.
  schedule(Math.min(config.workerIntervalMs, 15_000));
}

export function stopDigestDeliveryWorker() {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Test helper: clear in-memory send throttle. */
export function resetDigestSendThrottle() {
  lastSentAtByWorkspace.clear();
}
