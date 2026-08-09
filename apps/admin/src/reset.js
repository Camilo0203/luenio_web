import { confirmPasswordReset, requestPasswordReset } from "./api-client.js";
import { attachPasswordStrength, protectAuthForm, scorePassword } from "./auth-security.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";

loadInterFonts();

const form = document.querySelector("#resetForm");
const token = new URLSearchParams(location.hash.replace(/^#/, "")).get("token") || "";
if (token) window.history.replaceState({}, "", "/restablecer-acceso");
const resetMode = Boolean(token);
const button = form.querySelector('button[type="submit"]');
const status = form.querySelector(".form-status");
let security = { payload: () => ({}), reset: () => {} };

if (resetMode) {
  document.querySelector("[data-reset-title]").textContent = "Crea una nueva contraseña.";
  document.querySelector("[data-reset-copy]").textContent =
    "El enlace es de un solo uso y expira automáticamente.";
  document.querySelector("[data-email-field]").hidden = true;
  document.querySelector("[data-password-field]").hidden = false;
  document.querySelector("[data-confirmation-field]").hidden = false;
  button.textContent = "Guardar nueva contraseña";
  const passwordInput = form.querySelector('[name="password"]');
  const meter = document.querySelector("[data-password-strength]");
  if (passwordInput && meter) {
    meter.hidden = false;
    attachPasswordStrength(passwordInput, meter);
  }
}

function setStatus(state, message) {
  form.dataset.state = state;
  button.disabled = state === "loading";
  status.hidden = !message;
  status.textContent = message || "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.dataset.state === "loading") return;
  const data = new FormData(form);
  setStatus("loading", "Procesando solicitud...");
  try {
    if (!resetMode) {
      const email = String(data.get("email") || "").trim();
      if (!email.includes("@")) return setStatus("error", "Escribe un correo válido.");
      await requestPasswordReset(email);
      security.reset();
      return setStatus("success", "Si la cuenta existe, enviaremos un enlace de recuperación.");
    }
    const password = String(data.get("password") || "");
    if (password.length < 12) return setStatus("error", "Usa mínimo 12 caracteres.");
    if (scorePassword(password).score < 2)
      return setStatus("error", "Usa mayúsculas, minúsculas y números o símbolos.");
    if (password !== String(data.get("confirmation") || ""))
      return setStatus("error", "Las contraseñas no coinciden.");
    const { response, data: result } = await confirmPasswordReset({ token, password });
    if (!response.ok) return setStatus("error", result.error || "El enlace no es válido.");
    setStatus("success", "Contraseña actualizada. Ya puedes iniciar sesión.");
    window.setTimeout(() => location.assign("/login"), 700);
  } catch {
    setStatus("error", "No pudimos conectar con el servidor.");
    security.reset();
  }
});

protectAuthForm(form, { action: resetMode ? "password_reset" : "password_reset_request" })
  .then((api) => {
    security = api;
  })
  .catch(() => {});
