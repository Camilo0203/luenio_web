import { buildPublicReadiness, buildReadiness } from "../../config/readiness.js";
import { getStorageHealth, testStorageConnection } from "../../db/storage.js";

function publicStorageHealth(storage) {
  return {
    mode: storage.mode,
    supabaseConfigured: storage.supabaseConfigured,
    supabaseRequired: storage.supabaseRequired,
  };
}

function buildHealthPayload({ ok, connection = null, error = null }) {
  const storage = getStorageHealth();
  const readiness = buildReadiness();

  return {
    ok,
    app: "luenio-saas-crm",
    storage: publicStorageHealth(storage),
    ...(connection ? { connection } : {}),
    integrations: readiness.integrations,
    readiness: buildPublicReadiness(readiness),
    ...(error ? { error } : {}),
    timestamp: new Date().toISOString(),
  };
}

export async function getPublicHealth() {
  try {
    const connection = await testStorageConnection();
    return {
      status: 200,
      body: buildHealthPayload({ ok: true, connection }),
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
