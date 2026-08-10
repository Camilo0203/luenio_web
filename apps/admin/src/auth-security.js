/**
 * Login security: Turnstile and/or Luenio Guard + honeypot + form timing.
 */
import { getPublicConfig } from "../../web/src/public-config-client.js";
import { getAuthGuard } from "./api-client.js";

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

function injectHoneypot(form) {
  if (form.querySelector('[name="website"]')) return form.querySelector('[name="website"]');
  const honeypot = document.createElement("input");
  honeypot.type = "text";
  honeypot.name = "website";
  honeypot.tabIndex = -1;
  honeypot.autocomplete = "off";
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.className = "auth-honeypot";
  form.append(honeypot);
  return honeypot;
}

/**
 * Full bot protection for auth forms.
 * @returns {Promise<{ payload: () => object, reset: () => void, mode: string, refreshGuard: () => Promise<void> }>}
 */
export async function protectAuthForm(form, { action = "login", mountEl } = {}) {
  const formStartedAt = new Date().toISOString();
  const honeypot = injectHoneypot(form);
  let turnstileToken = "";
  let widgetId;
  let guardChallengeId = "";
  let guardAnswer = "";
  let mode = "none";
  let guardMeta = null;

  const host =
    mountEl ||
    form.querySelector("[data-bot-mount]") ||
    (() => {
      const el = document.createElement("div");
      el.className = "wide auth-bot-mount";
      el.setAttribute("data-bot-mount", "");
      const submit = form.querySelector('button[type="submit"]');
      form.insertBefore(el, submit);
      return el;
    })();

  async function loadGuardFromApi() {
    const { response, data } = await getAuthGuard();
    if (!response.ok) throw new Error(data.error || "No se pudo cargar la verificación");
    return data;
  }

  function renderLuenioGuard(data) {
    mode = "luenio-guard";
    guardChallengeId = data.challengeId || "";
    guardAnswer = "";
    host.innerHTML = "";
    host.classList.add("luenio-guard");

    const head = document.createElement("div");
    head.className = "luenio-guard__head";
    head.innerHTML = `
      <span class="luenio-guard__badge">Luenio Guard</span>
      <p class="luenio-guard__prompt">${escapeHtml(data.prompt || "Verificación humana")}</p>
    `;
    host.append(head);

    const grid = document.createElement("div");
    grid.className = "luenio-guard__grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Verificación humana");

    for (const opt of data.options || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "luenio-guard__tile";
      btn.dataset.id = opt.id;
      btn.innerHTML = `<span class="luenio-guard__emoji" aria-hidden="true">${opt.emoji || ""}</span><span>${escapeHtml(opt.label || opt.id)}</span>`;
      btn.addEventListener("click", () => {
        guardAnswer = opt.id;
        grid.querySelectorAll(".luenio-guard__tile").forEach((el) => {
          el.classList.toggle("is-selected", el === btn);
        });
        host.dispatchEvent(new CustomEvent("guard-change", { bubbles: true }));
      });
      grid.append(btn);
    }
    host.append(grid);

    const foot = document.createElement("button");
    foot.type = "button";
    foot.className = "luenio-guard__refresh";
    foot.textContent = "Otra verificación";
    foot.addEventListener("click", () => {
      void refreshGuard();
    });
    host.append(foot);
  }

  async function mountTurnstile(siteKey, required) {
    mode = "turnstile";
    host.innerHTML = "";
    host.classList.remove("luenio-guard");
    const wrap = document.createElement("div");
    wrap.className = "turnstile-field";
    host.append(wrap);
    const note = document.createElement("p");
    note.className = "luenio-guard__note";
    note.textContent = required
      ? "Verificación Cloudflare Turnstile (anti-bot)."
      : "Verificación Cloudflare Turnstile.";
    host.append(note);

    const turnstile = await loadTurnstile().catch(() => null);
    if (!turnstile) {
      // fallback to guard
      const data = await loadGuardFromApi();
      if (data.mode === "luenio-guard") renderLuenioGuard(data);
      return;
    }
    widgetId = turnstile.render(wrap, {
      sitekey: siteKey,
      action,
      theme: "dark",
      size: "flexible",
      callback: (value) => {
        turnstileToken = value;
      },
      "expired-callback": () => {
        turnstileToken = "";
      },
      "error-callback": () => {
        turnstileToken = "";
      },
    });
  }

  async function refreshGuard() {
    guardAnswer = "";
    turnstileToken = "";
    const data = await loadGuardFromApi();
    guardMeta = data;
    if (data.mode === "turnstile" && data.turnstileSiteKey) {
      await mountTurnstile(data.turnstileSiteKey, Boolean(data.turnstileRequired));
    } else if (data.mode === "luenio-guard") {
      renderLuenioGuard(data);
    } else {
      host.innerHTML = `<p class="luenio-guard__note">Verificación no disponible. Recarga la página.</p>`;
    }
    document.dispatchEvent(new CustomEvent("luenio-guard-ready", { detail: data }));
  }

  // Prefer server guard config; fall back to public-config turnstile
  try {
    await refreshGuard();
  } catch {
    const config = await getPublicConfig().catch(() => ({}));
    if (config.turnstileSiteKey) {
      await mountTurnstile(config.turnstileSiteKey, Boolean(config.turnstileRequired));
    } else {
      host.innerHTML = `<p class="luenio-guard__note error">No se pudo cargar la verificación. Recarga.</p>`;
    }
  }

  return {
    mode: () => mode,
    meta: () => guardMeta,
    refreshGuard,
    payload() {
      return {
        turnstileToken,
        website: honeypot.value,
        formStartedAt,
        guardChallengeId,
        guardAnswer,
      };
    },
    reset() {
      turnstileToken = "";
      guardAnswer = "";
      if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
      host
        .querySelectorAll(".luenio-guard__tile")
        .forEach((el) => el.classList.remove("is-selected"));
      // refresh one-time challenge
      if (mode === "luenio-guard") void refreshGuard();
    },
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Score password 0–4 and human label (es).
 */
export function scorePassword(password) {
  const p = String(password || "");
  let score = 0;
  if (p.length >= 12) score += 1;
  if (p.length >= 16) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 1;
  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];
  return { score, label: labels[score] || labels[0], max: 4 };
}

/**
 * Attach live strength meter under a password input.
 */
export function attachPasswordStrength(input, meterRoot) {
  if (!input || !meterRoot) return;
  meterRoot.classList.add("pwd-strength");
  meterRoot.innerHTML = `
    <div class="pwd-strength__bar" aria-hidden="true"><span></span></div>
    <p class="pwd-strength__label" data-pwd-label></p>
  `;
  const fill = meterRoot.querySelector("span");
  const label = meterRoot.querySelector("[data-pwd-label]");
  const update = () => {
    const { score, label: text, max } = scorePassword(input.value);
    const pct = Math.round((score / max) * 100);
    fill.style.width = `${pct}%`;
    meterRoot.dataset.score = String(score);
    label.textContent = input.value ? `Fortaleza: ${text}` : "Mínimo 12 caracteres";
  };
  input.addEventListener("input", update);
  update();
}

/** Safe post-login path from query or result. */
export function resolveNextPath(preferred) {
  const fromQuery = new URLSearchParams(window.location.search).get("next");
  const raw = String(preferred || fromQuery || "/dashboard").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/dashboard";
  if (raw === "/app" || raw.startsWith("/app?") || raw === "/crm" || raw.startsWith("/crm?")) {
    return "/dashboard";
  }
  return raw.slice(0, 512) || "/dashboard";
}

/** Lightweight client device summary (not a secret fingerprint). */
export function deviceSummary() {
  const ua = navigator.userAgent || "";
  let browser = "Navegador";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "Sistema";
  return { browser, os, language: navigator.language || "es", platform: navigator.platform || "" };
}
