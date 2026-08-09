/**
 * Premium CRM shell bootstrap.
 * Fetches real data from /api/crm/* (Neon). No mock arrays.
 */
import {
  injectCrmStyles,
  createShell,
  renderAgencyCommandCenter,
  renderKanbanBoard,
  renderClientTable,
  renderInvoiceList,
  renderProjectTimeline,
  createMetricsSkeleton,
  createEmptyState,
  showToast,
  openModal,
  animateLedgerTransition,
} from "../../../components/index.js";

/**
 * @param {{ root: HTMLElement, userEmail?: string }} opts
 */
export async function mountCrmApp({ root, userEmail = "" } = {}) {
  injectCrmStyles();

  // Prefer light for parity with /dashboard (ops); user can still toggle
  let theme = "light";
  try {
    const saved = localStorage.getItem("luenio-theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-theme", theme);

  let current = "dashboard";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let clientPage = 0;
  let clientSearch = "";
  let clientRequest = 0;
  let clientSearchTimer = 0;
  let navigationController = null;

  async function loadDashboard(outlet, signal) {
    const res = await api("/api/crm/dashboard", { signal });
    outlet.replaceChildren(
      renderAgencyCommandCenter(res.data, {
        onNavigate: (id) => navigate(id, { force: true }),
      }),
    );
  }

  function wrapSection({ kicker, title, meta, body }) {
    const wrap = document.createElement("div");
    wrap.className = "crm-view";
    const head = document.createElement("header");
    head.className = "crm-view__head";
    head.innerHTML = `
      <div>
        <p class="crm-view__kicker">${kicker}</p>
        <h2 class="crm-view__title">${title}</h2>
      </div>
      ${meta ? `<p class="crm-view__meta">${meta}</p>` : ""}
    `;
    wrap.append(head, body);
    return wrap;
  }

  function readFocusLead() {
    try {
      const id = sessionStorage.getItem("crm:focusLead");
      if (id) sessionStorage.removeItem("crm:focusLead");
      return id || null;
    } catch {
      return null;
    }
  }

  function openCreateDealModal({ onCreated } = {}) {
    const form = document.createElement("form");
    form.className = "ui-modal-form";
    form.addEventListener("submit", (e) => e.preventDefault());
    form.innerHTML = `
      <label>
        Nombre del deal
        <input name="name" type="text" required maxlength="200" placeholder="Ej. Rediseño web ACME" autocomplete="off" />
      </label>
      <div class="ui-modal-form__row">
        <label>
          Valor (USD)
          <input name="value" type="number" min="0" step="1" value="0" />
        </label>
        <label>
          Probabilidad (%)
          <input name="probability" type="number" min="0" max="100" step="1" value="10" />
        </label>
      </div>
      <label>
        Etapa
        <select name="stage">
          <option value="nuevo" selected>Nuevo</option>
          <option value="contactado">Contactado</option>
          <option value="propuesta">Propuesta</option>
          <option value="negociacion">Negociación</option>
          <option value="ganado">Ganado</option>
          <option value="perdido">Perdido</option>
        </select>
      </label>
    `;

    requestAnimationFrame(() => {
      form.querySelector("[name=name]")?.focus();
    });

    openModal({
      title: "Nuevo deal",
      body: form,
      confirmLabel: "Crear deal",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        const name = String(form.querySelector("[name=name]")?.value || "").trim();
        if (!name) {
          showToast({ message: "El nombre del deal es obligatorio", tone: "error" });
          form.querySelector("[name=name]")?.focus();
          return false;
        }

        const value = Number(form.querySelector("[name=value]")?.value ?? 0);
        const probability = Number(form.querySelector("[name=probability]")?.value ?? 10);
        const stage = String(form.querySelector("[name=stage]")?.value || "nuevo");

        try {
          await api("/api/crm/leads", {
            method: "POST",
            body: {
              name,
              value: Number.isFinite(value) ? value : 0,
              probability: Number.isFinite(probability) ? probability : 10,
              stage,
            },
          });
          showToast({ message: "Deal creado", tone: "success" });
          await onCreated?.();
          return true;
        } catch (e) {
          showToast({
            message: friendlyCrmError(e, "No pudimos crear el deal. Inténtalo de nuevo."),
            tone: "error",
          });
          return false;
        }
      },
    });
  }

  async function loadPipeline(outlet, signal) {
    const focusLeadId = readFocusLead();
    const res = await api("/api/crm/pipeline", { signal });
    const summary = res.summary || [];
    const open = summary.filter((s) => !["ganado", "perdido"].includes(s.stage));
    const count = open.reduce((n, s) => n + Number(s.count || 0), 0);
    const value = open.reduce((n, s) => n + Number(s.total_value || 0), 0);
    const board = renderKanbanBoard({
      board: res.data,
      focusLeadId,
      onCreate: () =>
        openCreateDealModal({
          onCreated: () => loadPipeline(outlet),
        }),
      onMove: async ({ id, stage, position }) => {
        try {
          await api(`/api/crm/leads/${id}/stage`, {
            method: "PATCH",
            body: { stage, position },
          });
          showToast({ message: "Etapa actualizada", tone: "success" });
          await loadPipeline(outlet);
        } catch (e) {
          showToast({
            message: friendlyCrmError(e, "No pudimos mover el deal. Inténtalo de nuevo."),
            tone: "error",
          });
        }
      },
    });
    outlet.replaceChildren(
      wrapSection({
        kicker: "Oportunidades",
        title: "Pipeline",
        meta: `${count} deals abiertos · ${formatMoney(value)}`,
        body: board,
      }),
    );
  }

  async function loadClients(outlet, signal) {
    const request = ++clientRequest;
    const qs = new URLSearchParams({
      page: String(clientPage),
      limit: "25",
    });
    if (clientSearch) qs.set("q", clientSearch);
    const res = await api(`/api/crm/clients?${qs}`, { signal });
    if (request !== clientRequest || current !== "clientes") return;
    const table = renderClientTable({
      clients: res.data,
      total: res.total,
      page: clientPage,
      pageSize: 25,
      onSearch: (q) => {
        clientSearch = String(q || "").slice(0, 200);
        clientPage = 0;
        window.clearTimeout(clientSearchTimer);
        clientSearchTimer = window.setTimeout(() => {
          loadClients(outlet).catch((error) => {
            if (error?.name === "AbortError") return;
            showToast({
              message: friendlyCrmError(error, "No pudimos buscar clientes. Inténtalo de nuevo."),
              tone: "error",
            });
          });
        }, 250);
      },
      onPage: (dir) => {
        clientPage = Math.max(0, clientPage + (dir === "next" ? 1 : -1));
        loadClients(outlet);
      },
    });
    outlet.replaceChildren(
      wrapSection({
        kicker: "Cartera",
        title: "Clientes",
        meta: `${res.total ?? res.data?.length ?? 0} registros`,
        body: table,
      }),
    );
  }

  async function loadProjects(outlet, signal) {
    const res = await api("/api/crm/projects", { signal });
    const list = res.data || [];
    const active = list.filter((p) => p.status === "activo").length;
    const body = renderProjectTimeline({ projects: list });
    outlet.replaceChildren(
      wrapSection({
        kicker: "Delivery",
        title: "Proyectos",
        meta: `${active} activos · ${list.length} total`,
        body,
      }),
    );
  }

  async function loadInvoices(outlet, signal) {
    const res = await api("/api/crm/invoices", { signal });
    const list = res.data || [];
    const open = (res.totals || [])
      .filter((t) => ["enviada", "vencida"].includes(t.status))
      .reduce((n, t) => n + Number(t.total || 0), 0);
    const body = renderInvoiceList({ invoices: list });
    outlet.replaceChildren(
      wrapSection({
        kicker: "Cobranza",
        title: "Facturación",
        meta: `${list.length} docs · abiertas ${formatMoney(open)}`,
        body,
      }),
    );
  }

  async function loadSettings(outlet, signal) {
    const res = await api("/api/crm/users", { signal });
    const wrap = document.createElement("div");
    wrap.className = "settings-panel";
    const list = document.createElement("div");
    list.className = "stagger-in settings-panel__list";
    for (const u of res.data || []) {
      const row = document.createElement("div");
      row.className = "settings-panel__row";
      row.innerHTML = `<div><strong>${escapeHtml(u.name)}</strong><div class="settings-panel__email">${escapeHtml(u.email)}</div></div><span class="settings-panel__role">${escapeHtml(u.role)}</span>`;
      list.append(row);
    }
    wrap.append(list);
    outlet.replaceChildren(
      wrapSection({
        kicker: "Configuración",
        title: "Equipo",
        meta: `${res.data?.length ?? 0} personas`,
        body: wrap,
      }),
    );
  }

  function formatMoney(n) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  }

  const ROUTES = {
    dashboard: { title: "Inicio", load: loadDashboard },
    pipeline: { title: "Pipeline", load: loadPipeline },
    clientes: { title: "Clientes", load: loadClients },
    proyectos: { title: "Proyectos", load: loadProjects },
    facturacion: { title: "Facturación", load: loadInvoices },
    configuracion: { title: "Equipo", load: loadSettings },
  };

  const shell = createShell({
    active: current,
    title: ROUTES.dashboard.title,
    subtitle: "Agencia · cartera",
    userEmail,
    theme,
    onNavigate: (id) => navigate(id),
    onThemeToggle: () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      shell.setThemeLabel(next);
      try {
        localStorage.setItem("luenio-theme", next);
      } catch {
        /* ignore */
      }
    },
    onRefresh: () => navigate(current, { force: true }),
  });

  root.replaceChildren(shell.root);

  async function navigate(id, { force } = {}) {
    if (!ROUTES[id]) id = "dashboard";
    if (id === current && !force) return;
    const previous = current;
    const routeIds = Object.keys(ROUTES);
    const direction = routeIds.indexOf(id) >= routeIds.indexOf(previous) ? 1 : -1;
    navigationController?.abort();
    navigationController = new AbortController();
    if (id !== "clientes") {
      clientRequest += 1;
      window.clearTimeout(clientSearchTimer);
    }
    current = id;
    // Keep hash in sync (e.g. ACC → pipeline focus) without relying only on sidebar clicks
    const desired = `#/${id}`;
    if (location.hash !== desired) {
      try {
        history.replaceState(null, "", desired);
      } catch {
        location.hash = `/${id}`;
      }
    }
    shell.setView(id, ROUTES[id].title);
    shell.outlet.replaceChildren(createMetricsSkeleton(4));
    try {
      await ROUTES[id].load(shell.outlet, navigationController.signal);
      if (!reduceMotion && previous !== id)
        animateLedgerTransition(shell.outlet.firstElementChild, direction);
      shell.setOnline(true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      shell.setOnline(false);
      const message = friendlyCrmError(err, "No pudimos cargar esta sección. Inténtalo de nuevo.");
      shell.outlet.replaceChildren(
        createEmptyState({
          title: "No pudimos cargar tus datos",
          description: message,
          ctaLabel: "Reintentar",
          onCta: () => navigate(id, { force: true }),
        }),
      );
      showToast({ message, tone: "error" });
      window.Sentry?.captureException?.(err);
    }
  }

  const fromHash = () => {
    const h = (location.hash || "#/dashboard").replace(/^#\/?/, "").split("?")[0];
    return ROUTES[h] ? h : "dashboard";
  };
  window.addEventListener("hashchange", () => navigate(fromHash(), { force: true }));
  await navigate(fromHash(), { force: true });

  return shell;
}

async function api(path, { method = "GET", body, signal, timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(json.error || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return json;
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("La solicitud tardó demasiado.");
      timeoutError.name = "TimeoutError";
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

function friendlyCrmError(error, fallback) {
  const status = Number(error?.status || 0);
  const detail = String(error?.message || "").toLowerCase();

  if (status === 401 || detail.includes("unauthorized") || detail.includes("sesión expirada")) {
    return "Tu sesión venció. Vuelve a iniciar sesión para continuar.";
  }
  if (status === 403 || detail.includes("forbidden")) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (status === 429 || detail.includes("too many")) {
    return "Hay demasiadas solicitudes en este momento. Espera un minuto y vuelve a intentarlo.";
  }
  if (status === 408 || error?.name === "TimeoutError") {
    return "La solicitud tardó demasiado. Revisa tu conexión y vuelve a intentarlo.";
  }
  if (
    detail.includes("fetch") ||
    detail.includes("network") ||
    detail.includes("database") ||
    detail.includes("conexión")
  ) {
    return "No pudimos conectar con tus datos. Revisa tu conexión e inténtalo de nuevo.";
  }

  return fallback;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default mountCrmApp;
export { api as requestCrmJson };
