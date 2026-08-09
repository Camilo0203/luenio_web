/**
 * Sentry instrumentation for Node (API + server).
 * No-ops to a local log sink when SENTRY_DSN is missing.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Sentry from "@sentry/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localLogPath = path.join(__dirname, "..", ".sentry-local.log");

let initialized = false;

function stripSensitiveServerData(event) {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
  }
  return event;
}

export function initSentry() {
  if (initialized) return Sentry;
  const dsn = process.env.SENTRY_DSN || process.env.SENTRY_DSN_SERVER;
  if (!dsn) {
    initialized = true;
    return Sentry;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || "luenio@0.1.0",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
    sendDefaultPii: false,
    beforeSend: stripSensitiveServerData,
  });
  initialized = true;
  return Sentry;
}

function writeLocalSink(payload) {
  try {
    fs.appendFileSync(localLogPath, JSON.stringify(payload) + "\n", "utf8");
  } catch {
    /* ignore */
  }
}

export function captureException(err, context = {}) {
  initSentry();
  if (!process.env.SENTRY_DSN && !process.env.SENTRY_DSN_SERVER) {
    console.error("[sentry-fallback]", err?.message || err, context);
    writeLocalSink({
      ts: new Date().toISOString(),
      type: "exception",
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      context,
    });
    return "local-sink";
  }
  return Sentry.captureException(err, { extra: context });
}

export function captureMessage(message, level = "info", context = {}) {
  initSentry();
  if (!process.env.SENTRY_DSN && !process.env.SENTRY_DSN_SERVER) {
    console.log(`[sentry-fallback:${level}]`, message, context);
    writeLocalSink({
      ts: new Date().toISOString(),
      type: "message",
      level,
      message,
      context,
    });
    return "local-sink";
  }
  return Sentry.captureMessage(message, { level, extra: context });
}

export { Sentry };
