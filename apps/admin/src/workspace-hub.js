/**
 * Post-login workspace chooser — product entry without raw URLs.
 */
import {
  getSession,
  listSessions,
  logout as apiLogout,
  revokeOtherSessions,
  revokeSession,
} from "./api-client.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";

loadInterFonts();

const STORAGE_KEY = "luenio-workspace";

const WORKSPACES = {
  leads: { href: "/dashboard", label: "Leads · producto" },
  crm: { href: "/crm", label: "Agencia · cartera" },
};

function readLastWorkspace() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return WORKSPACES[v] ? v : null;
  } catch {
    return null;
  }
}

export function rememberWorkspace(id) {
  try {
    if (WORKSPACES[id]) localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function wireCards() {
  document.querySelectorAll("[data-workspace]").forEach((el) => {
    el.addEventListener("click", () => {
      rememberWorkspace(el.getAttribute("data-workspace"));
    });
  });
}

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

async function renderSessions(panel) {
  if (!panel) return;
  panel.hidden = false;
  const listEl = panel.querySelector("[data-sessions-list]");
  const statusEl = panel.querySelector("[data-sessions-status]");
  listEl.innerHTML = '<p class="hub-sessions__empty">Cargando sesiones…</p>';

  try {
    const { response, data } = await listSessions();
    if (!response.ok) {
      listEl.innerHTML = `<p class="hub-sessions__empty">${data.error || "No se pudieron cargar las sesiones."}</p>`;
      return;
    }
    const sessions = data.data || [];
    if (!sessions.length) {
      listEl.innerHTML = '<p class="hub-sessions__empty">No hay sesiones activas.</p>';
      return;
    }

    listEl.innerHTML = "";
    for (const s of sessions) {
      const row = document.createElement("div");
      row.className = "hub-session" + (s.current ? " is-current" : "");
      row.innerHTML = `
        <div class="hub-session__main">
          <strong>${s.current ? "Este dispositivo" : "Otra sesión"}</strong>
          <span>Inicio ${fmtWhen(s.createdAt)} · expira ${fmtWhen(s.expiresAt)}</span>
        </div>
      `;
      if (!s.current) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hub-btn hub-btn--ghost hub-btn--sm";
        btn.textContent = "Cerrar";
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const res = await revokeSession(s.id);
          if (res.response.ok) {
            if (statusEl) statusEl.textContent = "Sesión cerrada.";
            await renderSessions(panel);
          } else {
            btn.disabled = false;
            if (statusEl) statusEl.textContent = res.data.error || "No se pudo cerrar.";
          }
        });
        row.append(btn);
      } else {
        const badge = document.createElement("span");
        badge.className = "hub-session__badge";
        badge.textContent = "Actual";
        row.append(badge);
      }
      listEl.append(row);
    }
  } catch {
    listEl.innerHTML = '<p class="hub-sessions__empty">Error de red al cargar sesiones.</p>';
  }
}

async function main() {
  wireCards();

  const last = readLastWorkspace();
  const resume = document.getElementById("hubResume");
  const continueBtn = document.getElementById("hubContinue");
  const resumeHint = document.getElementById("hubResumeHint");
  if (last && resume && continueBtn) {
    resume.hidden = false;
    resumeHint.textContent = WORKSPACES[last].label;
    continueBtn.addEventListener("click", () => {
      window.location.assign(WORKSPACES[last].href);
    });
  }

  let session = null;
  try {
    const { response, data } = await getSession();
    if (response.ok && data?.authenticated) session = data;
  } catch {
    session = null;
  }

  // In production the server already gates /app. In dev, send guests to login.
  if (!session) {
    const isLocal =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname === "0.0.0.0";
    if (!isLocal) {
      window.location.assign("/login?next=" + encodeURIComponent("/app"));
      return;
    }
  }

  if (session) {
    const email = session.user?.email || session.email || "";
    const userBox = document.getElementById("hubUser");
    const emailEl = document.getElementById("hubUserEmail");
    const logoutBtn = document.getElementById("hubLogout");
    if (userBox && emailEl && email) {
      emailEl.textContent = email;
      userBox.hidden = false;
    }
    if (logoutBtn) {
      logoutBtn.hidden = false;
      logoutBtn.addEventListener("click", async () => {
        try {
          await apiLogout();
        } catch {
          /* ignore */
        }
        window.location.assign("/login");
      });
    }

    const sessionsPanel = document.getElementById("hubSessions");
    await renderSessions(sessionsPanel);

    document.getElementById("hubRevokeOthers")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const { response, data } = await revokeOtherSessions();
        const statusEl = document.querySelector("[data-sessions-status]");
        if (response.ok) {
          if (statusEl) statusEl.textContent = `Cerradas ${data.revoked ?? 0} sesión(es).`;
          await renderSessions(sessionsPanel);
        } else if (statusEl) {
          statusEl.textContent = data.error || "No se pudo cerrar otras sesiones.";
        }
      } finally {
        btn.disabled = false;
      }
    });
  }
}

main();
