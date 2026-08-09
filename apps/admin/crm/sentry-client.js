let ready = false;
let setupPromise = null;

function stripSensitiveBrowserData(event) {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
  }
  return event;
}

async function initializeSentry() {
  try {
    const response = await fetch("/api/public-config");
    if (!response.ok) return null;
    const config = await response.json();
    const dsn = config?.sentryDsn || null;
    if (!dsn || ready) return null;

    const Sentry = await import("@sentry/browser");
    Sentry.init({
      dsn,
      environment: config.environment || "development",
      release: "luenio-crm@0.1.0",
      tracesSampleRate: 0.15,
      sendDefaultPii: false,
      beforeSend: stripSensitiveBrowserData,
    });
    window.Sentry = Sentry;
    ready = true;
    return Sentry;
  } catch (error) {
    console.warn("[sentry] browser init skipped:", error?.message || error);
    return null;
  }
}

export function setupSentryFromConfig() {
  if (ready) return Promise.resolve(window.Sentry || null);
  if (!setupPromise) setupPromise = initializeSentry();
  return setupPromise;
}
