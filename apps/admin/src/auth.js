import { authenticate, getSession } from "./api-client.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";
import { deviceSummary, protectAuthForm, resolveNextPath } from "./auth-security.js";

loadInterFonts();

const form = document.querySelector("#authForm");
const lead = document.querySelector("[data-auth-lead]");
const backBtn = document.querySelector("#authBack");
const togglePassword = document.querySelector("#togglePassword");
const capsHint = document.querySelector("#capsHint");
let challengeId = "";
let security = {
  payload: () => ({}),
  reset: () => {},
  mode: () => "none",
  refreshGuard: async () => {},
};
let pendingNext = resolveNextPath();
let authReady = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateAuthState() {
  if (!authReady || reduceMotion) return;
  form?.animate(
    [
      { clipPath: "inset(0 0 7% 0)", opacity: 0.72, transform: "translateY(7px)" },
      { clipPath: "inset(0)", opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

function setStatus(targetForm, state, message) {
  const button =
    targetForm.querySelector("#authSubmit") || targetForm.querySelector("button[type='submit']");
  const status = targetForm.querySelector(".form-status");

  targetForm.dataset.state = state;
  if (button) {
    button.disabled = state === "loading";
    button.textContent =
      state === "loading"
        ? "Validando seguridad…"
        : targetForm.dataset.mfa === "true"
          ? "Verificar código"
          : "Entrar al workspace";
  }
  if (status) {
    status.textContent = message || "";
    status.hidden = !message;
    status.dataset.tone = state === "error" ? "error" : state === "success" ? "success" : "";
  }
}

function setStep(n) {
  document.querySelectorAll("#authSteps li").forEach((li) => {
    const step = Number(li.dataset.step);
    li.classList.toggle("is-active", step === n);
    li.classList.toggle("is-done", step < n);
  });
}

function setCheck(id, state) {
  // state: pending | ok | warn
  const el = document.querySelector(`#authLive [data-check="${id}"]`);
  if (!el) return;
  el.dataset.state = state;
}

function humanAuthError(result) {
  let msg = result?.error || "No se pudo autenticar.";
  if (result?.retryAfterSeconds) {
    const min = Math.max(1, Math.ceil(Number(result.retryAfterSeconds) / 60));
    msg = result.error || `Demasiados intentos fallidos. Por seguridad espera ${min} minuto(s).`;
  }
  if (
    /storage service|servicio de datos|supabase|SESSION_CREATE|AUTH_STORAGE/i.test(
      msg + (result?.code || ""),
    )
  ) {
    msg = "No pudimos completar el acceso (datos/sesión). Intenta de nuevo en un momento.";
  }
  if (result?.code === "GUARD_REQUIRED" || result?.code === "GUARD_WRONG") {
    msg = result.error || "Completa la verificación humana (icono correcto).";
  }
  if (result?.code === "FORM_TOO_FAST") {
    msg = "Vas muy rápido. Espera un segundo y vuelve a enviar.";
  }
  if (/Invalid email or password/i.test(msg)) {
    msg = "Email o contraseña incorrectos.";
  }
  return msg;
}

function goToWorkspace(next) {
  setStep(3);
  setCheck("session", "ok");
  window.location.assign(resolveNextPath(next));
}

function setLoginOnlyVisible(show) {
  document.querySelectorAll("[data-login-only]").forEach((el) => {
    el.hidden = !show;
  });
  if (lead) {
    lead.innerHTML = show
      ? "Continúa donde dejaste tus conversaciones y oportunidades."
      : "Ingresa el código de 6 dígitos enviado a tu correo de administrador.";
  }
}

function enterMfaMode(nextChallengeId) {
  challengeId = nextChallengeId;
  form.dataset.mfa = "true";
  form.querySelectorAll("[data-login-field]").forEach((field) => {
    field.hidden = true;
    field.querySelector("input")?.removeAttribute("required");
  });
  const mfaField = form.querySelector("[data-mfa-field]");
  mfaField.hidden = false;
  const remember = form.querySelector("[data-remember-device]");
  if (remember) remember.hidden = false;
  const codeInput = mfaField.querySelector("input");
  codeInput.required = true;
  if (form.elements.password) form.elements.password.value = "";
  if (backBtn) backBtn.hidden = false;
  setLoginOnlyVisible(false);
  setStep(2);
  setCheck("guard", "ok");
  animateAuthState();
  codeInput.focus();
}

function exitMfaMode() {
  challengeId = "";
  form.dataset.mfa = "false";
  form.querySelectorAll("[data-login-field]").forEach((field) => {
    field.hidden = false;
    const input = field.querySelector("input");
    if (input?.name === "email" || input?.name === "password") input.required = true;
  });
  const mfaField = form.querySelector("[data-mfa-field]");
  if (mfaField) {
    mfaField.hidden = true;
    const codeInput = mfaField.querySelector("input");
    if (codeInput) {
      codeInput.required = false;
      codeInput.value = "";
    }
  }
  const remember = form.querySelector("[data-remember-device]");
  if (remember) {
    remember.hidden = true;
    const cb = remember.querySelector("input");
    if (cb) cb.checked = false;
  }
  if (backBtn) backBtn.hidden = true;
  setLoginOnlyVisible(true);
  setStep(1);
  animateAuthState();
}

function initSecurityPanel() {
  const secure =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  setCheck("tls", secure ? "ok" : "warn");
  setCheck("lockout", "ok");
  setCheck("session", "pending");
  setCheck("guard", "pending");
  setCheck("device", "ok");

  const dev = deviceSummary();
  const deviceText = document.getElementById("authDeviceText");
  if (deviceText) {
    deviceText.textContent = `${dev.browser} · ${dev.os} · ${dev.language}`;
  }
}

document.querySelectorAll(".brand-logo").forEach((logo) => {
  const brand = logo.closest(".brand");
  const showLogo = () => {
    brand?.classList.add("has-logo");
    brand?.classList.remove("logo-error");
  };
  const showFallback = () => {
    brand?.classList.remove("has-logo");
    brand?.classList.add("logo-error");
  };
  logo.addEventListener("load", showLogo, { once: true });
  logo.addEventListener("error", showFallback);
  if (logo.complete && logo.naturalWidth > 0) showLogo();
});

togglePassword?.addEventListener("click", () => {
  const input = form?.elements?.password;
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Ocultar" : "Ver";
  togglePassword.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
});

form?.elements?.password?.addEventListener("keyup", (e) => {
  if (!capsHint) return;
  const on = e.getModifierState && e.getModifierState("CapsLock");
  capsHint.hidden = !on;
});

backBtn?.addEventListener("click", () => {
  exitMfaMode();
  setStatus(form, "idle", "");
  form.elements.password?.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const sec = security.payload();

  if (challengeId) {
    const code = String(data.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) {
      setStatus(form, "error", "Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }
    setStatus(form, "loading", "Verificando código MFA…");
    try {
      const rememberDevice = Boolean(form.querySelector('[name="rememberDevice"]')?.checked);
      const { response, data: result } = await authenticate({
        action: "verify_mfa",
        challengeId,
        code,
        next: pendingNext,
        rememberDevice,
      });
      if (!response.ok) {
        setStatus(form, "error", humanAuthError(result));
        return;
      }
      setStatus(form, "success", "Acceso confirmado. Abriendo tu espacio…");
      window.setTimeout(() => goToWorkspace(result.next), 350);
    } catch {
      setStatus(form, "error", "No pudimos verificar el código. Intenta nuevamente.");
    }
    return;
  }

  // Client-side guard gate for better UX
  if (security.mode?.() === "luenio-guard" && !sec.guardAnswer) {
    setStatus(form, "error", "Completa Luenio Guard: haz clic en el icono indicado.");
    setStep(2);
    setCheck("guard", "warn");
    return;
  }

  const payload = {
    action: "login",
    email: String(data.get("email") || "").trim(),
    password: String(data.get("password") || ""),
    next: pendingNext,
    ...sec,
  };

  if (!payload.email || !payload.password) {
    setStatus(form, "error", "Email y contraseña son obligatorios.");
    return;
  }
  if (payload.password.length < 12) {
    setStatus(form, "error", "La contraseña debe tener mínimo 12 caracteres.");
    return;
  }

  setStep(2);
  setCheck("guard", "ok");
  setStatus(form, "loading", "Comprobando identidad y anti-bot…");

  try {
    const { response, data: result } = await authenticate(payload);

    if (!response.ok) {
      exitMfaMode();
      setStatus(form, "error", humanAuthError(result));
      security.reset();
      setCheck("guard", "warn");
      setStep(1);
      return;
    }

    if (result.mfaRequired && result.challengeId) {
      pendingNext = resolveNextPath(result.next);
      enterMfaMode(result.challengeId);
      setStatus(form, "success", "Enviamos un código de verificación a tu correo.");
      return;
    }

    setStatus(form, "success", "Identidad verificada. Abriendo tu espacio…");
    window.setTimeout(() => goToWorkspace(result.next), 350);
  } catch (error) {
    console.warn("[Luenio Auth] Request failed", error);
    setStatus(
      form,
      "error",
      "No pudimos conectar con el servidor. Comprueba que esté en marcha e inténtalo de nuevo.",
    );
    security.reset();
    setStep(1);
  }
});

initSecurityPanel();

protectAuthForm(form, { action: "login" })
  .then((api) => {
    security = api;
    setCheck("guard", "ok");
    document.addEventListener("luenio-guard-ready", () => setCheck("guard", "ok"));
  })
  .catch(() => {
    setCheck("guard", "warn");
  });

exitMfaMode();
authReady = true;
syncSession();

async function syncSession() {
  const session = await getSession()
    .then(({ data }) => data)
    .catch(() => null);
  if (session?.authenticated) {
    setCheck("session", "ok");
    window.location.href = resolveNextPath();
  }
}
