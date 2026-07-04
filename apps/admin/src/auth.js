import { authenticate, getSession } from "./api-client.js";

const form = document.querySelector("#authForm");

function currentMode() {
  return document.body.dataset.authMode || "login";
}

function submitLabel(mode = currentMode()) {
  return mode === "register" ? "Crear workspace" : "Entrar al dashboard";
}

function setStatus(targetForm, state, message) {
  const button = targetForm.querySelector("button[type='submit']");
  const status = targetForm.querySelector(".form-status");
  const mode = currentMode();

  targetForm.dataset.state = state;
  button.disabled = state === "loading";
  button.textContent = state === "loading" ? "Validando..." : submitLabel(mode);
  status.textContent = message || "";
  status.hidden = !message;
}

function setMode(mode) {
  document.body.dataset.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });

  const password = form?.querySelector("input[name='password']");
  const submit = form?.querySelector("button[type='submit']");
  if (password) password.autocomplete = mode === "register" ? "new-password" : "current-password";
  if (submit) submit.textContent = submitLabel(mode);
  if (form) setStatus(form, "idle", "");
}

async function syncSession() {
  const session = await getSession().then(({ data }) => data).catch(() => null);
  if (session?.authenticated) window.location.href = "/dashboard";
}

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.authMode));
});

document.querySelectorAll(".brand-logo").forEach((logo) => {
  const brand = logo.closest(".brand");
  const showLogo = () => brand?.classList.add("has-logo");
  const showFallback = () => brand?.classList.remove("has-logo");
  logo.addEventListener("load", showLogo, { once: true });
  logo.addEventListener("error", showFallback);
  if (logo.complete && logo.naturalWidth > 0) showLogo();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = currentMode();
  const data = new FormData(form);
  const payload = {
    action: mode,
    businessName: String(data.get("businessName") || "").trim(),
    email: String(data.get("email") || "").trim(),
    password: String(data.get("password") || ""),
    plan: String(data.get("plan") || "starter"),
  };

  if (!payload.email || !payload.password) {
    setStatus(form, "error", "Email y password son obligatorios.");
    return;
  }
  if (payload.password.length < 8) {
    setStatus(form, "error", "El password debe tener mínimo 8 caracteres.");
    return;
  }
  if (mode === "register" && payload.businessName.length < 2) {
    setStatus(form, "error", "Escribe el nombre del negocio.");
    return;
  }

  setStatus(form, "loading", mode === "register" ? "Creando workspace..." : "Iniciando sesión...");

  try {
    const { response, data: result } = await authenticate(payload);

    if (!response.ok) {
      setStatus(form, "error", result.error || "No se pudo autenticar.");
      return;
    }

    setStatus(form, "success", "Acceso confirmado. Abriendo dashboard...");
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 300);
  } catch (error) {
    console.warn("[Luenio Auth] Request failed", error);
    setStatus(form, "error", "No pudimos conectar con el servidor. Intenta de nuevo en unos segundos.");
  }
});

setMode("login");
syncSession();
