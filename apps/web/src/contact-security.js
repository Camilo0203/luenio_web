import { getPublicConfig } from "./public-config-client.js";

let turnstileScriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(window.turnstile));
    script.addEventListener("error", () => reject(new Error("Turnstile unavailable")));
    document.head.append(script);
  });
  return turnstileScriptPromise;
}

export async function protectContactForm(form) {
  const startedAt = new Date().toISOString();
  let token = "";
  let widgetId;
  const honeypot = document.createElement("input");
  honeypot.type = "text";
  honeypot.name = "website";
  honeypot.tabIndex = -1;
  honeypot.autocomplete = "off";
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.className = "contact-honeypot";
  form.append(honeypot);

  const config = await getPublicConfig();
  if (config.turnstileRequired && config.turnstileSiteKey) {
    const mount = document.createElement("div");
    mount.className = "turnstile-field";
    const submit = form.querySelector('button[type="submit"]');
    form.insertBefore(mount, submit);
    const turnstile = await loadTurnstile().catch(() => null);
    if (turnstile)
      widgetId = turnstile.render(mount, {
        sitekey: config.turnstileSiteKey,
        action: "contact",
        theme: "auto",
        size: "flexible",
        callback: (value) => {
          token = value;
        },
        "expired-callback": () => {
          token = "";
        },
        "error-callback": () => {
          token = "";
        },
      });
  }

  return {
    payload() {
      return {
        turnstileToken: token,
        website: honeypot.value,
        formStartedAt: startedAt,
      };
    },
    reset() {
      token = "";
      if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
    },
  };
}
