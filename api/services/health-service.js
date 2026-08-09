import { buildPublicReadiness, buildReadiness } from "../../config/readiness.js";
import {
  getContactDeliveryHealth,
  getStorageHealth,
  testStorageConnection,
} from "../../db/storage.js";

function publicStorageHealth(storage) {
  return {
    mode: storage.mode,
    supabaseConfigured: storage.supabaseConfigured,
    supabaseRequired: storage.supabaseRequired,
  };
}

function buildHealthPayload({ ok, connection = null, deliveryQueue = null, error = null }) {
  const storage = getStorageHealth();
  const readiness = buildReadiness();

  return {
    ok,
    app: "luenio-saas-crm",
    storage: publicStorageHealth(storage),
    ...(connection ? { connection } : {}),
    ...(deliveryQueue ? { deliveryQueue } : {}),
    integrations: readiness.integrations,
    readiness: buildPublicReadiness(readiness),
    ...(error ? { error } : {}),
    timestamp: new Date().toISOString(),
  };
}

export async function getPublicHealth() {
  return {
    status: 200,
    body: {
      ok: true,
      status: "available",
      timestamp: new Date().toISOString(),
    },
  };
}

export async function getDetailedHealth() {
  try {
    const connection = await testStorageConnection();
    const deliveryQueue = await getContactDeliveryHealth();
    const ok = deliveryQueue.healthy;
    return {
      status: ok ? 200 : 503,
      body: buildHealthPayload({
        ok,
        connection,
        deliveryQueue,
        error: ok ? null : "Contact delivery queue is degraded.",
      }),
    };
  } catch {
    return {
      status: 503,
      body: buildHealthPayload({
        ok: false,
        error: "Storage connection unavailable.",
      }),
    };
  }
}
