import { getPublicConfig } from "./public-config-client.js";

const consentKey = "luenio.analytics.consent";
const eventKey = "luenio.analytics.events";
let measurementId = null;
let analyticsLoaded = false;

const sensitivePropertyKeys = new Set([
  "name",
  "business",
  "phone",
  "email",
  "message",
  "objective",
  "website",
  "formStartedAt",
  "turnstileToken",
]);

export function sanitizeAnalyticsProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => {
        if (sensitivePropertyKeys.has(key)) return false;
        return ["string", "number", "boolean"].includes(typeof value);
      })
      .map(([key, value]) => [
        key,
        typeof value === "string"
          ? [...value]
              .map((character) =>
                character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127 ? " " : character,
              )
              .join("")
              .slice(0, 160)
          : value,
      ]),
  );
}

function consentCommand(command, value) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
  window.gtag("consent", command, value);
}

consentCommand("default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

function loadAnalytics() {
  if (!measurementId || analyticsLoaded) return;
  analyticsLoaded = true;
  consentCommand("update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
}

// Storage can be unavailable (Safari private mode, blocked third-party storage).
// Treat that as "no stored choice" rather than letting it throw: an exception in
// saveConsent would leave the banner permanently undismissable, and one in
// initAnalytics would reject its promise and skip the cookie-settings binding.
function readStoredConsent() {
  try {
    return localStorage.getItem(consentKey);
  } catch {
    return null;
  }
}

function writeStoredConsent(value) {
  try {
    localStorage.setItem(consentKey, value);
  } catch {
    // The choice still applies for this page view; it just will not persist.
  }
}

function saveConsent(value) {
  writeStoredConsent(value);
  document.querySelector("[data-consent-banner]")?.remove();
  if (value === "accepted") loadAnalytics();
  else consentCommand("update", { analytics_storage: "denied" });
}

function showBanner() {
  document.querySelector("[data-consent-banner]")?.remove();
  const banner = document.createElement("aside");
  banner.className = "consent-banner";
  banner.dataset.consentBanner = "";
  banner.setAttribute("aria-label", "Preferencias de privacidad");
  banner.innerHTML = `<p><strong>Privacidad bajo tu control.</strong> Usamos analítica para mejorar Luenio. No cargamos Google Analytics sin tu permiso.</p><div><button type="button" data-consent="necessary">Solo necesarias</button><button type="button" data-consent="accepted">Aceptar analítica</button></div>`;
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("[data-consent]");
    if (button) saveConsent(button.dataset.consent);
  });
  document.body.append(banner);
}

export async function initAnalytics() {
  const config = await getPublicConfig();
  measurementId = config.gaMeasurementId;
  if (!config.analyticsEnabled) return;
  if (!document.querySelector("[data-cookie-settings]")) {
    const footer = document.querySelector("footer");
    if (footer) {
      const settings = document.createElement("button");
      settings.type = "button";
      settings.className = "cookie-settings-link";
      settings.dataset.cookieSettings = "";
      settings.textContent = "Preferencias de cookies";
      footer.append(settings);
    }
  }
  const consent = readStoredConsent();
  if (consent === "accepted") loadAnalytics();
  else if (!consent) showBanner();
  document.querySelectorAll("[data-cookie-settings]").forEach((button) => {
    button.addEventListener("click", showBanner);
  });
}

export function trackEvent(name, properties = {}) {
  const safeProperties = sanitizeAnalyticsProperties(properties);
  const event = {
    name: String(name || "event").slice(0, 80),
    properties: safeProperties,
    page: location.pathname,
    timestamp: new Date().toISOString(),
  };
  try {
    const stored = JSON.parse(localStorage.getItem(eventKey) || "[]");
    stored.push(event);
    localStorage.setItem(eventKey, JSON.stringify(stored.slice(-80)));
  } catch {
    // Analytics must never interrupt conversion paths.
  }
  if (analyticsLoaded && window.gtag) window.gtag("event", event.name, safeProperties);
}
