import { acceptInvitation } from "./api-client.js";
import { attachPasswordStrength, scorePassword } from "./auth-security.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";

loadInterFonts();

const form = document.querySelector("#inviteForm");
const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
if (token) window.history.replaceState({}, "", "/aceptar-invitacion");

const passwordInput = form?.querySelector('[name="password"]');
const meter = document.querySelector("[data-password-strength]");
if (passwordInput && meter) attachPasswordStrength(passwordInput, meter);

function setStatus(state, message) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector(".form-status");
  form.dataset.state = state;
  button.disabled = state === "loading";
  button.textContent = state === "loading" ? "Activando acceso..." : "Activar mi acceso";
  status.hidden = !message;
  status.textContent = message || "";
}

if (!token) setStatus("error", "Esta invitación no es válida. Solicita un enlace nuevo a Luenio.");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token || form.dataset.state === "loading") return;
  const data = new FormData(form);
  const password = String(data.get("password") || "");
  const confirmation = String(data.get("confirmation") || "");
  if (password.length < 12)
    return setStatus("error", "La contraseña debe tener mínimo 12 caracteres.");
  if (scorePassword(password).score < 2)
    return setStatus("error", "Usa mayúsculas, minúsculas y números o símbolos.");
  if (password !== confirmation) return setStatus("error", "Las contraseñas no coinciden.");
  setStatus("loading", "Validando tu invitación...");
  try {
    const { response, data: result } = await acceptInvitation({ token, password });
    if (!response.ok)
      return setStatus("error", result.error || "No se pudo activar la invitación.");
    if (result.mfaRequired) {
      setStatus("success", "Acceso activado. Inicia sesión para verificar el segundo factor...");
      window.setTimeout(() => window.location.assign("/login?activated=admin"), 650);
      return;
    }
    setStatus("success", "Acceso activado. Abriendo tu espacio…");
    window.setTimeout(() => window.location.assign("/app"), 450);
  } catch {
    setStatus("error", "No pudimos conectar con el servidor. Intenta nuevamente.");
  }
});
