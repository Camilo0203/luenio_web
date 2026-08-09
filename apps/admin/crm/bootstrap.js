/**
 * Bootstrap premium CRM app — real Neon data via /api/crm/*
 */
import { mountCrmApp } from "./app.js";
import { setupSentryFromConfig } from "./sentry-client.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";

loadInterFonts();

function preferredTheme() {
  try {
    const saved = localStorage.getItem("luenio-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  // Default light — same family as /dashboard ops
  return "light";
}

async function fetchSessionEmail() {
  try {
    const res = await fetch("/api/crm/me", { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return "";
    const email = json?.data?.email;
    if (email) return String(email);
    if (json?.data?.publicMode) return "Demo";
    return "";
  } catch {
    return "";
  }
}

async function main() {
  const theme = preferredTheme();
  document.documentElement.setAttribute("data-theme", theme);

  const root = document.getElementById("crm-root");
  if (!root) return;

  try {
    const userEmail = await fetchSessionEmail();
    await mountCrmApp({
      root,
      userEmail,
    });
    const startObservability = () => void setupSentryFromConfig();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(startObservability, { timeout: 2500 });
    } else {
      window.setTimeout(startObservability, 0);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <div class="crm-boot" role="alert">
        <div style="text-align:center;max-width:360px;padding:24px">
          <strong style="color:var(--color-text);display:block;margin-bottom:8px">No se pudo iniciar el CRM</strong>
          <span>${String(err?.message || err)}</span>
        </div>
      </div>`;
    const sentry = window.Sentry || (await setupSentryFromConfig());
    sentry?.captureException?.(err);
  }
}

main();
