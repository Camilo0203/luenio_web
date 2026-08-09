import {
  bulkUpdateLeads,
  createInvitation,
  getBilling,
  getHealth,
  getInvitations,
  getLeads,
  getSession,
  getSettings,
  importLeads,
  logout,
  previewDigest,
  revokeInvitation,
  updatePipeline,
} from "./api-client.js";
import { parseCrmCsv } from "./csv-import.js";
import { createLiveDemoController } from "./demo/live-demo.js";
import { downloadLeadsCsv } from "./export-csv.js";
import { classificationLabel, safeNumber, safeText, stageLabel } from "./format.js";
import {
  createDemoEvent,
  getEventId,
  getWorkspaceActions,
  getWorkspaceEvents,
  getWorkspaceLeads,
  isDemoLead,
  normalizeLeadFromApi,
} from "./lead-model.js";
import {
  dismissOnboardingBanner,
  getOnboardingProgress,
  isOnboardingBannerDismissed,
  markOnboardingStep,
} from "./onboarding-progress.js";
import { buildCrmReports } from "./reports.js";
import {
  buildMailtoUrl,
  buildWhatsAppUrl,
  getEmailTemplate,
  getReplyTemplate,
} from "./reply-templates.js";
import { formatScoreReasons } from "./score-copy.js";
import { demoStepTemplate, stages, state } from "./state.js";
import { buildWorkQueue, matchesSmartFilter } from "./work-queue.js";
import { loadInterFonts } from "../../web/src/load-fonts.js";

loadInterFonts();

const compactTimeFormatter = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const compactDateTimeFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateTimeFormatter = new Intl.DateTimeFormat("es", {
  dateStyle: "short",
  timeStyle: "short",
});
const invitationDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});
const secondaryPanelLoaded = new Set();
const secondaryPanelPending = new Map();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateSecondaryPanel(panel) {
  if (reduceMotion || !panel?.open) return;
  const content = panel.querySelector(":scope > section");
  content?.animate(
    [
      { clipPath: "inset(0 0 10% 0)", opacity: 0.72, transform: "translateY(-6px)" },
      { clipPath: "inset(0)", opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

function showLiveStatus(message = "En línea") {
  const element = document.querySelector("#liveStatus");
  const text = document.querySelector("#liveStatusText") || element?.lastChild;
  if (!element || !text) return;

  text.textContent = message;
  element.classList.add("pulse");
  window.clearTimeout(showLiveStatus.timeout);
  showLiveStatus.timeout = window.setTimeout(() => {
    text.textContent = "En línea";
    element.classList.remove("pulse");
  }, 2200);
}

function detectLiveChanges(nextLeads, nextEvents) {
  const previousLeadIds = new Set(state.leads.map((lead) => lead.id));
  const previousStages = new Map(state.leads.map((lead) => [lead.id, lead.status]));
  const previousEventIds = new Set(state.events.map(getEventId));

  state.newLeadIds = new Set();
  state.newEventIds = new Set();
  state.updatedStages = new Set();

  if (!state.hydrated) return;

  nextLeads.forEach((lead) => {
    if (!previousLeadIds.has(lead.id)) {
      state.newLeadIds.add(lead.id);
      return;
    }
    if (previousStages.get(lead.id) && previousStages.get(lead.id) !== lead.status) {
      state.updatedStages.add(lead.status);
    }
  });

  nextEvents.forEach((event) => {
    const eventId = getEventId(event);
    if (!previousEventIds.has(eventId)) state.newEventIds.add(eventId);
  });

  if (state.newLeadIds.size) {
    const count = state.newLeadIds.size;
    showLiveStatus(
      `${count} ${count === 1 ? "lead nuevo sincronizado" : "leads nuevos sincronizados"}`,
    );
  } else if (state.updatedStages.size) {
    showLiveStatus("Pipeline actualizado");
  } else if (state.newEventIds.size) {
    showLiveStatus("Evento de automatización recibido");
  }
}

async function fetchCrm() {
  const { response, data } = await getLeads({
    q: state.searchQuery || "",
    limit: 500,
  });
  if (!response.ok) throw new Error(`CRM request failed ${response.status}`);

  const nextLeads = (data.leads || []).map(normalizeLeadFromApi);
  const nextEvents = data.events || [];
  detectLiveChanges(nextLeads, nextEvents);
  state.leads = nextLeads;
  state.actions = data.actions || [];
  state.notifications = data.notifications || [];
  state.events = nextEvents;
  state.members = Array.isArray(data.members) ? data.members : [];
  state.storage = "protected";
  state.hydrated = true;
  populateAssigneeSelects();
  // Drop selections that no longer exist
  const validIds = new Set(nextLeads.map((lead) => lead.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
  return data;
}

function toggleLeadSelection(leadId, selected) {
  if (!leadId || String(leadId).startsWith("demo_lead_")) return;
  if (selected) state.selectedIds.add(leadId);
  else state.selectedIds.delete(leadId);
  renderBulkBar();
}

function renderBulkBar() {
  const bar = document.querySelector("#bulkActionsBar");
  const count = document.querySelector("#bulkSelectionCount");
  if (!bar || !count) return;
  const size = state.selectedIds.size;
  bar.hidden = size === 0;
  count.textContent = `${size} seleccionado${size === 1 ? "" : "s"}`;
}

async function fetchSession() {
  const { response, data } = await getSession();
  if (!response.ok || !data.authenticated) {
    window.location.href = "/login";
    return null;
  }
  state.user = data.user;
  const invitationWrap = document.querySelector("#invitationPanelWrap");
  if (invitationWrap && !["admin", "owner"].includes(String(data.user.role || "").toLowerCase())) {
    invitationWrap.hidden = true;
  }
  try {
    localStorage.setItem("luenio-workspace", "leads");
  } catch {
    /* ignore */
  }
  document.querySelectorAll("[data-workspace]").forEach((el) => {
    el.addEventListener("click", () => {
      try {
        localStorage.setItem("luenio-workspace", el.getAttribute("data-workspace") || "leads");
      } catch {
        /* ignore */
      }
    });
  });
  return data.user;
}

async function fetchHealth() {
  const { response, data } = await getHealth();
  state.health = { ...data, httpOk: response.ok };
  return state.health;
}

async function fetchBilling() {
  const { response, data } = await getBilling();
  state.billing = { ...data, httpOk: response.ok };
  return state.billing;
}

async function fetchSettings() {
  const { response, data } = await getSettings();
  state.settings = { ...data, httpOk: response.ok };
  return state.settings;
}

async function fetchInvitations() {
  const panel = document.querySelector("#invitationPanel");
  const wrap = document.querySelector("#invitationPanelWrap");
  const { response, data } = await getInvitations();
  if (response.status === 403) {
    if (panel) panel.hidden = true;
    if (wrap) wrap.hidden = true;
    return [];
  }
  if (!response.ok) throw new Error(data.error || "No se pudieron cargar las invitaciones.");
  state.invitations = data.invitations || [];
  if (panel) panel.hidden = false;
  if (wrap) wrap.hidden = false;
  renderInvitations();
  return state.invitations;
}

function renderInvitations() {
  const list = document.querySelector("#invitationList");
  if (!list) return;
  list.innerHTML = state.invitations.length
    ? state.invitations
        .map(
          (invitation) =>
            `<article><div><strong>${safeText(invitation.businessName)}</strong><span>${safeText(invitation.email)} · ${safeText(invitation.role)}</span><small>${safeText(invitation.status)} · vence ${invitationDateTimeFormatter.format(new Date(invitation.expiresAt))}</small></div>${invitation.status === "pending" ? `<button class="button button-small" type="button" data-revoke-invitation="${safeText(invitation.id)}">Revocar</button>` : ""}</article>`,
        )
        .join("")
    : '<p class="empty-state">No hay invitaciones creadas.</p>';
  list.querySelectorAll("[data-revoke-invitation]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { response } = await revokeInvitation(button.dataset.revokeInvitation);
      if (response.ok) await fetchInvitations();
      else button.disabled = false;
    });
  });
}

function populateAssigneeSelects() {
  const bulk = document.querySelector("#bulkAssigneeSelect");
  if (!bulk) return;
  const current = bulk.value;
  const options = [
    `<option value="">Asignar a…</option>`,
    `<option value="__me__">A mí</option>`,
    `<option value="__none__">Sin asignar</option>`,
    ...(state.members || [])
      .filter((member) => member.id !== state.user?.id)
      .map(
        (member) =>
          `<option value="${safeText(member.id)}">${safeText(member.email || member.id)}</option>`,
      ),
  ];
  bulk.innerHTML = options.join("");
  if ([...bulk.options].some((option) => option.value === current)) bulk.value = current;
}

function memberLabel(userId) {
  if (!userId) return "Sin asignar";
  if (userId === state.user?.id) return "Yo";
  const member = (state.members || []).find((row) => row.id === userId);
  return member?.email || userId;
}

function filteredLeads() {
  const query = String(state.searchQuery || "")
    .trim()
    .toLowerCase();
  const filterOptions = { currentUserId: state.user?.id || null };
  return getWorkspaceLeads().filter((lead) => {
    const matchesScore = state.filter === "all" || lead.classification === state.filter;
    const matchesStatus = state.statusFilter === "all" || lead.status === state.statusFilter;
    const matchesSmart = matchesSmartFilter(
      lead,
      state.smartFilter || "all",
      new Date(),
      filterOptions,
    );
    if (!matchesScore || !matchesStatus || !matchesSmart) return false;
    if (!query) return true;
    const haystack = [
      lead.name,
      lead.business,
      lead.phone,
      lead.service,
      lead.message,
      lead.source,
      lead.notes,
      lead.nextAction,
      ...(Array.isArray(lead.tags) ? lead.tags : []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function exportLeadsCsv(leads = filteredLeads()) {
  downloadLeadsCsv(leads, {
    onExported: (count) => {
      markOnboardingStep("export_csv");
      renderOnboardingBanner();
      showLiveStatus(`Exportados ${count} leads a CSV`);
    },
  });
}

function updateMetrics() {
  const leads = getWorkspaceLeads();
  const now = new Date();
  const dueToday = leads.filter((lead) => matchesSmartFilter(lead, "due_today", now)).length;
  const staleHot = leads.filter((lead) => matchesSmartFilter(lead, "stale_hot", now)).length;
  document.querySelector("#metricTotal").textContent = leads.length;
  document.querySelector("#metricHot").textContent = leads.filter(
    (lead) => lead.classification === "hot",
  ).length;
  document.querySelector("#metricWarm").textContent = leads.filter(
    (lead) => lead.classification === "warm",
  ).length;
  document.querySelector("#metricCold").textContent = leads.filter(
    (lead) => lead.classification === "cold" || lead.classification === "nurture",
  ).length;
  const dueEl = document.querySelector("#metricDueToday");
  if (dueEl) dueEl.textContent = String(dueToday);
  const dueCard = document.querySelector("#metricDueCard");
  if (dueCard) {
    dueCard.classList.toggle("is-alert", dueToday > 0 || staleHot > 0);
    dueCard.title =
      staleHot > 0
        ? `${dueToday} con acción hoy/vencida · ${staleHot} calientes sin tocar`
        : `${dueToday} con acción hoy o vencida`;
  }

  const storageBadge = document.querySelector("#storageBadge");
  if (storageBadge) {
    storageBadge.textContent = "Datos protegidos y sincronizados";
    storageBadge.classList.add("supabase");
  }
}

const STAGE_REPORT_LABELS = {
  new: "Nuevo",
  qualified: "Calificado",
  contacted: "Contactado",
  converted: "Convertido",
};

function renderReports() {
  const summary = document.querySelector("#reportsSummary");
  const sourcesEl = document.querySelector("#reportSources");
  const funnelEl = document.querySelector("#reportFunnel");
  if (!summary || !sourcesEl || !funnelEl) return;

  const report = buildCrmReports(getWorkspaceLeads(), {
    now: new Date(),
    days: state.reportDays || 30,
  });

  summary.innerHTML = `
    <article><span>En ventana</span><strong>${safeNumber(report.totals.leads)}</strong></article>
    <article><span>Histórico</span><strong>${safeNumber(report.totals.allTime)}</strong></article>
    <article><span>Calientes</span><strong>${safeNumber(report.totals.hot)}</strong></article>
    <article><span>Sin tocar (hot)</span><strong>${safeNumber(report.totals.staleHot)}</strong></article>
    <article><span>Vencen hoy</span><strong>${safeNumber(report.totals.dueToday)}</strong></article>
    <article><span>Sin contacto</span><strong>${safeNumber(report.totals.noContact)}</strong></article>
  `;

  sourcesEl.innerHTML = report.sources.length
    ? report.sources
        .slice(0, 8)
        .map(
          (row) => `
      <div class="report-bar-row">
        <div class="report-bar-row__meta">
          <strong>${safeText(row.source)}</strong>
          <span>${safeNumber(row.count)}</span>
        </div>
        <div class="report-bar-track" aria-hidden="true">
          <span data-bar-pct="${safeNumber(row.percent)}"></span>
        </div>
      </div>
    `,
        )
        .join("")
    : `<p class="empty-state compact">Sin leads en los últimos ${safeNumber(report.days)} días.</p>`;

  funnelEl.innerHTML = report.funnel
    .map(
      (row) => `
    <div class="report-bar-row">
      <div class="report-bar-row__meta">
        <strong>${safeText(STAGE_REPORT_LABELS[row.stage] || row.stage)}</strong>
        <span>${safeNumber(row.count)}</span>
      </div>
      <div class="report-bar-track" aria-hidden="true">
        <span data-bar-pct="${safeNumber(row.percent)}"></span>
      </div>
    </div>
  `,
    )
    .join("");

  document.querySelectorAll("#reports [data-bar-pct]").forEach((bar) => {
    const pct = Math.min(100, Math.max(0, Number(bar.dataset.barPct) || 0));
    bar.style.width = `${pct}%`;
  });

  document.querySelectorAll("[data-report-days]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.reportDays) === report.days);
  });
}

function renderUser() {
  const userBox = document.querySelector("#adminUser");
  if (!userBox || !state.user) return;
  const business = safeText(state.user.businessName, "Espacio de trabajo");
  const plan = safeText(state.user.plan, "starter");
  userBox.innerHTML = `
    <strong class="admin-user__email">${safeText(state.user.email)}</strong>
    <span class="admin-user__meta">${business} · ${plan}</span>
  `;
  const email = userBox.querySelector(".admin-user__email");
  if (email) email.title = String(state.user.email || "");
}

function setHealthItem(selector, label, status) {
  const element = document.querySelector(selector);
  if (!element) return;
  const card = element.closest("article");
  element.textContent = label;
  card?.classList.remove("ok", "warn", "error");
  card?.classList.add(status);
}

function renderHealth() {
  const health = state.health;
  const note = document.querySelector("#healthNote");
  if (!health) {
    setHealthItem("#healthDatabase", "Desconocido", "warn");
    return;
  }

  const serviceOnline = health.ok && health.httpOk;
  const statusLabel = serviceOnline ? "Operativo" : "Revisando";
  const statusClass = serviceOnline ? "ok" : "warn";
  setHealthItem("#healthDatabase", statusLabel, statusClass);
  setHealthItem("#healthCrmWebhook", statusLabel, statusClass);
  setHealthItem("#healthWhatsapp", statusLabel, statusClass);
  setHealthItem("#healthEmail", statusLabel, statusClass);

  if (note) {
    note.textContent = health.ok
      ? "Servicios del espacio de trabajo en línea."
      : "Estamos verificando la disponibilidad de los servicios.";
  }
}

function renderBilling() {
  const grid = document.querySelector("#billingGrid");
  const status = document.querySelector("#billingStatus");
  if (!grid) return;

  const usage = state.billing?.usage;
  const plan = state.billing?.currentPlan || state.user?.plan || "personalizado";
  grid.innerHTML = `<article><span>Configuración activa</span><strong>${safeText(plan)}</strong><p>${usage ? `${safeNumber(usage.used).toLocaleString()} leads procesados durante el periodo actual.` : "Alcance configurado por el equipo de Luenio."}</p><p>Los cambios de alcance y facturación se coordinan mediante una cotización personalizada.</p><a class="button button-small" href="mailto:contacto@luenio.com">Contactar a Luenio</a></article>`;
  if (status) status.hidden = true;
}

function renderChecklist() {
  const checklist = document.querySelector("#setupChecklist");
  if (!checklist || !state.settings?.checklist) return;

  const workspaceItems = state.settings.checklist.map((item) => ({
    ...item,
    group: "Espacio de trabajo",
  }));
  const readinessItems = (state.settings.readiness?.checks || []).map((item) => ({
    ...item,
    group: item.severity === "critical" ? "Producción" : "Recomendado",
  }));

  checklist.innerHTML = [...workspaceItems, ...readinessItems]
    .map(
      (item) => `
    <article class="checklist-item ${item.done ? "done" : "warn"}">
      <span>${safeText(item.group)} - ${item.done ? "Listo" : "Acción requerida"}</span>
      <strong>${safeText(item.label)}</strong>
      <p>${safeText(item.description)}</p>
    </article>
  `,
    )
    .join("");
}

function renderOnboarding() {
  const flow = document.querySelector("#onboardingFlow");
  if (!flow) return;
  const hasLeads = getWorkspaceLeads().length > 0;
  const hasDemo = state.demoLeads.length > 0;
  const workspaceName = state.user?.businessName || state.user?.email || "tu espacio de trabajo";
  const items = [
    {
      title: "Pantalla de bienvenida",
      description: state.user
        ? `Espacio de trabajo listo para ${workspaceName}.`
        : "Crea o accede a tu espacio de trabajo.",
      done: Boolean(state.user),
    },
    {
      title: "Conecta tu negocio",
      description: state.hydrated
        ? "El CRM y la capa de almacenamiento están disponibles."
        : "Conecta el almacenamiento y los canales de automatización.",
      done: state.hydrated,
    },
    {
      title: "Crea tu primer lead",
      description: hasLeads
        ? "La recepción de leads está activa en el CRM."
        : "Captura un lead real o ejecuta la Demo en Vivo.",
      done: hasLeads,
    },
    {
      title: "Mira el sistema en acción",
      description: hasDemo
        ? "El flujo de demo se completó dentro de este espacio de trabajo."
        : "Ejecuta la Demo en Vivo para mostrar el motor en acción.",
      done: hasDemo,
    },
  ];

  flow.innerHTML = items
    .map(
      (item, index) => `
    <article class="${item.done ? "done" : "pending"}">
      <span>${index + 1}</span>
      <strong>${safeText(item.title)}</strong>
      <p>${safeText(item.description)}</p>
    </article>
  `,
    )
    .join("");
}

function renderSystemSteps() {
  const steps = document.querySelector("#systemSteps");
  if (!steps) return;
  const activeLead = getWorkspaceLeads().find((lead) => lead.id === state.demo.currentLeadId);

  steps.innerHTML = demoStepTemplate
    .map((label, index) => {
      const isDone = state.demo.currentStep > index;
      const isActive = state.demo.currentStep === index;
      const stepLabel =
        index === 2 && activeLead
          ? `Lead calificado: ${classificationLabel(activeLead.classification)}${activeLead.classification === "hot" ? " 🔥" : ""}`
          : label;
      return `
      <article class="${isDone ? "done" : ""} ${isActive ? "active" : ""} ${index === 2 && activeLead ? `score-${safeText(activeLead.classification)}` : ""}">
        <span>${isDone ? "Listo" : isActive ? "En curso" : "Esperando"}</span>
        <strong>${safeText(stepLabel)}</strong>
      </article>
    `;
    })
    .join("");
}

function renderWorkQueue() {
  const root = document.querySelector("#workQueue");
  if (!root) return;
  const queue = buildWorkQueue(getWorkspaceLeads(), { limit: 5 });
  if (!queue.length) {
    root.innerHTML = `
      <div class="panel-head">
        <h2>Prioridades de hoy</h2>
        <span class="panel-count">0</span>
      </div>
      <div class="empty-state empty-state--inline">
        <strong>Sin pendientes urgentes</strong>
        <p>Aquí aparecen vencidos, calientes sin contacto y seguimientos.</p>
      </div>
    `;
    return;
  }
  root.innerHTML = `
    <div class="panel-head">
      <h2>Prioridades de hoy</h2>
      <span class="panel-count">${queue.length}</span>
    </div>
    <div class="work-queue-list">
      ${queue
        .map(
          (lead) => `
        <button type="button" class="work-queue-item score-${safeText(lead.classification)}" data-work-lead-id="${safeText(lead.id)}">
          <strong>${safeText(lead.name)}</strong>
          <span>${safeText(classificationLabel(lead.classification))} · ${safeText(stageLabel(lead.status))}</span>
          <small>${safeText(lead.nextAction || lead.service || "Definir próxima acción")}</small>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
  root.querySelectorAll("[data-work-lead-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLeadId = button.dataset.workLeadId;
      renderPipeline();
      renderLeadTable();
      renderDetail();
      document.querySelector("#leadDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderOnboardingBanner() {
  const root = document.querySelector("#onboardingBanner");
  if (!root) return;
  if (isOnboardingBannerDismissed()) {
    root.hidden = true;
    return;
  }
  const progress = getOnboardingProgress();
  if (progress.complete) {
    root.hidden = false;
    root.innerHTML = `
      <div class="onboarding-banner__copy">
        <strong>Espacio listo</strong>
        <span>Completaste los ${progress.total} pasos de arranque.</span>
      </div>
      <button type="button" class="button button-small" data-dismiss-onboarding>Ocultar 30 días</button>
    `;
  } else {
    root.hidden = false;
    root.innerHTML = `
      <div class="onboarding-banner__copy">
        <strong>Completa tu espacio (${progress.doneCount}/${progress.total})</strong>
        <ul>${progress.steps.map((step) => `<li class="${step.done ? "is-done" : ""}">${safeText(step.label)}</li>`).join("")}</ul>
      </div>
      <button type="button" class="button button-small" data-dismiss-onboarding>Ahora no</button>
    `;
  }
  root.querySelector("[data-dismiss-onboarding]")?.addEventListener("click", () => {
    dismissOnboardingBanner(30);
    root.hidden = true;
  });
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderAll() {
  updateMetrics();
  renderPipeline();
  renderLeadTable();
  renderDetail();
  renderWorkQueue();
  renderReports();
  renderOnboardingBanner();
  if (secondaryPanelLoaded.has("activity")) renderEvents();
  if (secondaryPanelLoaded.has("setup")) renderOnboarding();
  if (secondaryPanelLoaded.has("demo")) renderSystemSteps();
}

function formatEventTime(event) {
  const timestamp = event.created_at || event.timestamp;
  if (!timestamp) return "justo ahora";
  return compactDateTimeFormatter.format(new Date(timestamp));
}

function formatEventLabel(event, leadName) {
  const labels = {
    "message.received": "Mensaje de lead recibido",
    "intent.classified": "Intención clasificada por IA",
    "crm.updated": "Registro de CRM actualizado",
    "followup.triggered": "Seguimiento activado",
    "automation.triggered": "Automatización activada",
    "lead.created": "Lead creado",
    "pipeline.updated": "Pipeline actualizado",
    "lead.notes_updated": "Notas del lead actualizadas",
    "lead.tags_updated": "Etiquetas del lead actualizadas",
    "lead.metadata_updated": "Metadatos del lead actualizados",
    "lead.contact_logged": "Contacto registrado",
    "lead.next_action_updated": "Próxima acción actualizada",
    "subscription.updated": "Suscripción actualizada",
  };
  const label = labels[event.type] || event.type || "Evento del sistema";
  return leadName ? `${label} - ${leadName}` : label;
}

function formatEventDetail(event) {
  const payload = event.payload || {};
  if (event.type === "intent.classified")
    return `${classificationLabel(payload.classification) || "lead"} - puntaje ${payload.score || 0}/100`;
  if (event.type === "crm.updated")
    return payload.action || stageLabel(payload.pipelineStage) || "CRM sincronizado";
  if (event.type === "followup.triggered")
    return `${(payload.actions || []).length} acciones en cola`;
  if (event.type === "automation.triggered")
    return `${(payload.integrations || []).length} integraciones verificadas`;
  return (
    classificationLabel(payload.classification) ||
    payload.plan ||
    stageLabel(payload.pipelineStage) ||
    payload.source ||
    "sistema"
  );
}

function renderEvents() {
  const feed = document.querySelector("#activityFeed");
  if (!feed) return;
  const events = getWorkspaceEvents();
  const leads = getWorkspaceLeads();

  if (!events.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <strong>Aún no hay eventos de automatización</strong>
        <p>Los nuevos leads, actualizaciones de CRM y cambios de facturación aparecerán aquí automáticamente.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = events
    .slice(0, 10)
    .map((event) => {
      const leadName = leads.find((lead) => lead.id === (event.leadId || event.lead_id))?.name;
      const isNew = state.newEventIds.has(getEventId(event));
      return `
      <article class="activity-item ${isNew ? "is-new" : ""}">
        <strong>${safeText(formatEventLabel(event, leadName))}</strong>
        <span>${safeText(formatEventTime(event))} - ${safeText(formatEventDetail(event))}</span>
      </article>
    `;
    })
    .join("");
}

function renderPipeline() {
  const board = document.querySelector("#pipelineBoard");
  const visibleLeads = filteredLeads();

  board.innerHTML = stages
    .map((stage) => {
      const stageLeads = visibleLeads.filter((lead) => lead.status === stage);
      return `
      <section class="pipeline-column ${state.updatedStages.has(stage) ? "updated" : ""}" data-stage="${stage}">
        <h3>${safeText(stageLabel(stage))}<span>${stageLeads.length}</span></h3>
        <div class="lead-list">
          ${
            stageLeads
              .map(
                (lead) => `
            <div class="lead-row score-${safeText(lead.classification)} ${lead.demo ? "demo-lead" : ""} ${lead.id === state.selectedLeadId ? "active" : ""} ${state.newLeadIds.has(lead.id) ? "is-new" : ""}" data-lead-id="${safeText(lead.id)}">
              ${
                lead.demo
                  ? ""
                  : `<label class="lead-select"><input type="checkbox" data-select-lead="${safeText(lead.id)}" ${state.selectedIds.has(lead.id) ? "checked" : ""} /><span class="visually-hidden">Seleccionar ${safeText(lead.name)}</span></label>`
              }
              <button class="lead-row__open" type="button" data-open-lead="${safeText(lead.id)}">
                <span>${safeText(classificationLabel(lead.classification))}</span>
                <strong>${safeText(lead.name)}</strong>
                <small>${safeText(lead.business)} - ${safeText(lead.source, "directo")}</small>
                <small>${safeText(lead.service, "Sin servicio seleccionado")}</small>
                <small><b class="score-pill">${safeNumber(lead.score)}</b> ${lead.timestamp ? safeText(compactTimeFormatter.format(new Date(lead.timestamp))) : ""}</small>
              </button>
            </div>
          `,
              )
              .join("") ||
            `
            <div class="empty-state empty-state--column">
              <span>—</span>
            </div>
          `
          }
        </div>
      </section>
    `;
    })
    .join("");

  renderBulkBar();
}

function renderLeadTable() {
  const table = document.querySelector("#leadTable");
  if (!table) return;
  const leads = filteredLeads();

  if (!leads.length) {
    table.innerHTML = `
      <div class="empty-state empty-state--inline">
        <strong>Sin resultados con estos filtros</strong>
        <p>Prueba “Todos” o limpia la búsqueda. Los leads nuevos de cotización aparecerán aquí al instante.</p>
      </div>
    `;
    return;
  }

  table.innerHTML = `
    <div class="lead-table-row lead-table-head">
      <span></span>
      <span>Lead</span>
      <span>Negocio</span>
      <span>Score</span>
      <span>Etapa</span>
      <span>Última actividad</span>
    </div>
    ${leads
      .map(
        (lead) => `
      <div class="lead-table-row ${lead.id === state.selectedLeadId ? "active" : ""}" data-table-lead-id="${safeText(lead.id)}">
        <span>${
          lead.demo
            ? ""
            : `<label class="lead-select"><input type="checkbox" data-select-lead="${safeText(lead.id)}" ${state.selectedIds.has(lead.id) ? "checked" : ""} /><span class="visually-hidden">Seleccionar</span></label>`
        }</span>
        <button class="lead-table-open" type="button" data-open-table-lead="${safeText(lead.id)}">
          <strong>${safeText(lead.name)}</strong><small>${safeText(lead.service, "Sin servicio")}</small>
        </button>
        <span>${safeText(lead.business)}${lead.demo ? "<small>Demo en vivo</small>" : ""}</span>
        <span><b class="score-pill score-${safeText(lead.classification)}">${safeNumber(lead.score)}</b>${safeText(classificationLabel(lead.classification))}</span>
        <span>${safeText(stageLabel(lead.status))}</span>
        <span>${lead.timestamp ? safeText(compactDateTimeFormatter.format(new Date(lead.timestamp))) : "ahora"}</span>
      </div>
    `,
      )
      .join("")}
  `;

  renderBulkBar();
}

function renderDetail() {
  const detail = document.querySelector("#leadDetail");
  const lead = getWorkspaceLeads().find((item) => item.id === state.selectedLeadId);

  if (!lead) {
    detail.innerHTML = `
      <div class="detail-empty">
        <h2>Detalle</h2>
        <p>Selecciona un lead del pipeline o del listado.</p>
        <ol class="detail-empty__steps">
          <li>Abre un lead</li>
          <li>Revisa score y etapa</li>
          <li>Agenda la próxima acción</li>
        </ol>
      </div>
    `;
    return;
  }

  const action = getWorkspaceActions().find(
    (item) => item.lead_id === lead.id || item.leadId === lead.id,
  );
  const history = getWorkspaceEvents()
    .filter((event) => (event.leadId || event.lead_id) === lead.id)
    .slice(0, 6);
  const restrictedActions = action?.restrictedActions || action?.restricted_actions || [];
  detail.innerHTML = `
    <p class="eyebrow">Detalle del lead</p>
    <h2>${safeText(lead.name)}</h2>
    <p>${safeText(lead.business)} - ${safeText(lead.phone)}</p>
    <div class="detail-grid">
      <article><span>Score</span><strong>${safeNumber(lead.score)}/100 - ${safeText(classificationLabel(lead.classification))}</strong></article>
      <article><span>Pipeline</span><strong>${safeText(stageLabel(lead.status))}</strong></article>
      <article><span>Fuente</span><strong>${safeText(lead.source, "directo")}</strong></article>
      <article><span>Interés</span><strong>${safeText(lead.service)}</strong></article>
      <article><span>Flujo</span><strong>${safeText(lead.workflow || action?.workflow, "pendiente")}</strong></article>
      <article><span>Razones</span><strong>${safeText((lead.scoreReasons || []).join(", "), "Sin razones registradas")}</strong></article>
      <article><span>Etiquetas</span><strong>${safeText((lead.tags || []).join(", "), "Sin etiquetas")}</strong></article>
      <article><span>Próxima acción</span><strong>${safeText(lead.nextAction || "Sin definir")}</strong></article>
      <article><span>Último contacto</span><strong>${lead.lastContactedAt ? safeText(shortDateTimeFormatter.format(new Date(lead.lastContactedAt))) : "Nunca"}</strong></article>
      <article><span>Asignado a</span><strong>${safeText(memberLabel(lead.assigneeUserId))}</strong></article>
    </div>
    <form class="lead-assignee-form" id="leadAssigneeForm">
      <strong>Asignar lead</strong>
      <label>
        <span>Miembro del equipo</span>
        <select name="assigneeUserId">
          <option value="">Sin asignar</option>
          <option value="${safeText(state.user?.id || "")}" ${lead.assigneeUserId === state.user?.id ? "selected" : ""}>Yo (${safeText(state.user?.email || "sesión")})</option>
          ${(state.members || [])
            .filter((member) => member.id !== state.user?.id)
            .map(
              (member) =>
                `<option value="${safeText(member.id)}" ${lead.assigneeUserId === member.id ? "selected" : ""}>${safeText(member.email || member.id)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <button class="button button-small" type="submit">Guardar asignación</button>
    </form>

    <div class="score-reasons-block">
      <strong>Por qué este score</strong>
      <ul>${formatScoreReasons(lead.scoreReasons || [])
        .map((reason) => `<li>${safeText(reason)}</li>`)
        .join("")}</ul>
    </div>
    <div class="reply-templates">
      <strong>Plantilla WhatsApp</strong>
      <p class="reply-templates__text">${safeText(getReplyTemplate(lead))}</p>
      <div class="reply-templates__actions">
        <button class="button button-small" type="button" data-copy-reply>Copiar mensaje WhatsApp</button>
        ${buildWhatsAppUrl(lead) ? `<a class="button button-small button-primary" href="${safeText(buildWhatsAppUrl(lead))}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : ""}
      </div>
      <strong>Plantilla email</strong>
      <p class="reply-templates__text"><em>${safeText(getEmailTemplate(lead).subject)}</em><br />${safeText(getEmailTemplate(lead).body)}</p>
      <div class="reply-templates__actions">
        <button class="button button-small" type="button" data-copy-email>Copiar email</button>
        <a class="button button-small" href="${safeText(buildMailtoUrl(lead))}">Abrir correo</a>
      </div>
    </div>
    <form class="lead-next-action" id="leadNextActionForm">
      <strong>Próxima acción</strong>
      <label><span>Qué hacer</span><input name="nextAction" maxlength="200" value="${safeText(lead.nextAction || "")}" placeholder="Llamar / enviar propuesta" /></label>
      <label><span>Cuándo</span><input name="nextActionAt" type="datetime-local" value="${safeText(toDatetimeLocalValue(lead.nextActionAt))}" /></label>
      <button class="button button-small" type="submit">Guardar próxima acción</button>
    </form>
    <form class="lead-contact-log" id="leadContactLogForm">
      <strong>Registrar contacto</strong>
      <label><span>Tipo</span>
        <select name="type">
          <option value="whatsapp">WhatsApp</option>
          <option value="call">Llamada</option>
          <option value="email">Email</option>
          <option value="note">Nota</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label><span>Resumen</span><input name="summary" maxlength="500" required placeholder="Respondió; pide propuesta" /></label>
      <button class="button button-small" type="submit">Guardar contacto</button>
    </form>
    <div class="lead-contact-history">
      <strong>Historial de contactos</strong>
      ${
        (lead.contactLog || []).length
          ? (lead.contactLog || [])
              .slice(0, 10)
              .map(
                (entry) => `
        <article>
          <span>${safeText(entry.type)} · ${entry.createdAt ? safeText(shortDateTimeFormatter.format(new Date(entry.createdAt))) : ""}</span>
          <p>${safeText(entry.summary)}</p>
        </article>
      `,
              )
              .join("")
          : "<p>Sin contactos registrados.</p>"
      }
    </div>

    <form class="lead-metadata-form" id="leadMetadataForm" data-lead-id="${safeText(lead.id)}">
      <label class="lead-notes-field">
        <span>Notas internas</span>
        <textarea name="notes" rows="3" maxlength="2000" placeholder="Contexto comercial, acuerdos, objeciones...">${safeText(lead.notes || "")}</textarea>
      </label>
      <label class="lead-tags-field">
        <span>Etiquetas</span>
        <input name="tags" type="text" maxlength="200" value="${safeText((lead.tags || []).join(", "))}" placeholder="whatsapp, urgente, demo" />
      </label>
      <button class="button button-small" type="submit">Guardar notas y etiquetas</button>
      <p class="form-status" data-metadata-status role="status" aria-live="polite" hidden></p>
    </form>
    <div class="actions-history">
      <strong>Historial de acciones</strong>
      ${
        history.length
          ? history
              .map(
                (event) => `
        <article>
          <span>${safeText(formatEventTime(event))}</span>
          <p>${safeText(formatEventLabel(event))}</p>
          <small>${safeText(formatEventDetail(event))}</small>
        </article>
      `,
              )
              .join("")
          : "<p>Sin acciones registradas aún.</p>"
      }
    </div>
    ${
      restrictedActions.length
        ? `
      <div class="upgrade-callout">
        <strong>Mejorar tu plan desbloquea automatización</strong>
        <p>${safeText(restrictedActions.join(", "))} están restringidas en tu plan actual.</p>
        <button class="button button-primary button-small" type="button" data-open-billing>Ver facturación</button>
      </div>
    `
        : ""
    }
    <button class="button button-primary" type="button" data-next-stage="${safeText(lead.id)}">Mover etapa</button>
  `;

  detail.querySelector("[data-open-billing]")?.addEventListener("click", () => {
    const billingPanel = document.querySelector(".billing-panel");
    const fold = billingPanel?.closest("details.admin-fold");
    if (fold) fold.open = true;
    billingPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  detail.querySelector("[data-copy-reply]")?.addEventListener("click", async () => {
    const text = getReplyTemplate(lead);
    try {
      await navigator.clipboard.writeText(text);
      showLiveStatus("Mensaje WhatsApp copiado");
    } catch {
      showLiveStatus("No se pudo copiar el mensaje");
    }
  });

  detail.querySelector("[data-copy-email]")?.addEventListener("click", async () => {
    const email = getEmailTemplate(lead);
    const text = `${email.subject}\n\n${email.body}`;
    try {
      await navigator.clipboard.writeText(text);
      showLiveStatus("Email copiado");
    } catch {
      showLiveStatus("No se pudo copiar el email");
    }
  });

  detail.querySelector("#leadAssigneeForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const assigneeUserId = String(new FormData(form).get("assigneeUserId") || "") || null;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    if (isDemoLead(lead.id)) {
      lead.assigneeUserId = assigneeUserId;
      if (button) button.disabled = false;
      renderAll();
      showLiveStatus("Asignación de demo guardada");
      return;
    }
    const { response, data } = await updatePipeline({ leadId: lead.id, assigneeUserId });
    if (button) button.disabled = false;
    if (!response.ok) {
      showLiveStatus(data.error || "No se pudo asignar");
      return;
    }
    await loadDashboard({ showSkeleton: false });
    state.selectedLeadId = lead.id;
    renderDetail();
    showLiveStatus("Lead asignado");
  });

  detail.querySelector("#leadNextActionForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextAction = String(formData.get("nextAction") || "");
    const localValue = String(formData.get("nextActionAt") || "");
    const nextActionAt = localValue ? new Date(localValue).toISOString() : null;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    if (isDemoLead(lead.id)) {
      lead.nextAction = nextAction;
      lead.nextActionAt = nextActionAt;
      state.demoEvents.unshift(
        createDemoEvent("lead.next_action_updated", lead, { nextAction, nextActionAt }),
      );
      button.disabled = false;
      renderAll();
      showLiveStatus("Próxima acción de demo guardada");
      return;
    }
    await updatePipeline({ leadId: lead.id, nextAction, nextActionAt });
    button.disabled = false;
    await loadDashboard({ showSkeleton: false });
    state.selectedLeadId = lead.id;
    renderDetail();
    showLiveStatus("Próxima acción guardada");
  });

  detail.querySelector("#leadContactLogForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const logContact = {
      type: String(formData.get("type") || "note"),
      summary: String(formData.get("summary") || ""),
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    if (isDemoLead(lead.id)) {
      const entry = {
        id: `clog_demo_${Date.now()}`,
        type: logContact.type,
        summary: logContact.summary,
        createdAt: new Date().toISOString(),
      };
      lead.contactLog = [entry, ...(lead.contactLog || [])].slice(0, 50);
      lead.lastContactedAt = entry.createdAt;
      state.demoEvents.unshift(createDemoEvent("lead.contact_logged", lead, { type: entry.type }));
      button.disabled = false;
      form.reset();
      renderAll();
      showLiveStatus("Contacto de demo registrado");
      return;
    }
    await updatePipeline({ leadId: lead.id, logContact });
    button.disabled = false;
    await loadDashboard({ showSkeleton: false });
    state.selectedLeadId = lead.id;
    renderDetail();
    showLiveStatus("Contacto registrado");
  });

  detail.querySelector("#leadMetadataForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const statusEl = form.querySelector("[data-metadata-status]");
    const formData = new FormData(form);
    const notes = String(formData.get("notes") || "");
    const tags = String(formData.get("tags") || "")
      .split(/[,;]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    if (isDemoLead(lead.id)) {
      lead.notes = notes;
      lead.tags = tags;
      lead.timestamp = new Date().toISOString();
      const metaEvent = createDemoEvent("lead.metadata_updated", lead, { notes, tags });
      state.demoEvents.unshift(metaEvent);
      state.newEventIds.add(getEventId(metaEvent));
      button.disabled = false;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Notas de demo guardadas.";
      }
      renderAll();
      markOnboardingStep("add_note_or_tag");
      renderOnboardingBanner();
      showLiveStatus("Metadatos de demo actualizados");
      return;
    }
    const { response, data } = await updatePipeline({ leadId: lead.id, notes, tags });
    button.disabled = false;
    if (!response.ok) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = data.error || "No se pudieron guardar las notas.";
      }
      return;
    }
    await loadDashboard({ showSkeleton: false });
    state.selectedLeadId = lead.id;
    renderDetail();
    markOnboardingStep("add_note_or_tag");
    renderOnboardingBanner();
    showLiveStatus("Notas y etiquetas guardadas");
  });

  detail.querySelector("[data-next-stage]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const currentIndex = stages.indexOf(lead.status);
    const nextStage = stages[Math.min(Math.max(currentIndex, 0) + 1, stages.length - 1)];
    button.disabled = true;
    button.textContent = "Actualizando pipeline...";
    showLiveStatus(`Moviendo lead a ${stageLabel(nextStage)}`);
    if (isDemoLead(lead.id)) {
      lead.status = nextStage;
      lead.timestamp = new Date().toISOString();
      const pipelineEvent = createDemoEvent("pipeline.updated", lead, { pipelineStage: nextStage });
      state.demoEvents.unshift(pipelineEvent);
      state.newEventIds.add(getEventId(pipelineEvent));
      state.updatedStages = new Set([nextStage]);
      button.disabled = false;
      button.textContent = "Mover etapa";
      renderAll();
      markOnboardingStep("move_stage");
      renderOnboardingBanner();
      showLiveStatus("Pipeline de demo actualizado");
      return;
    }
    await updatePipeline({ leadId: lead.id, status: nextStage, pipelineStage: nextStage });
    markOnboardingStep("move_stage");
    renderOnboardingBanner();
    state.updatedStages = new Set([nextStage]);
    await loadDashboard();
    state.selectedLeadId = lead.id;
    showLiveStatus("Pipeline actualizado");
    renderDetail();
  });
}

const liveDemo = createLiveDemoController({
  showLiveStatus,
  renderAll,
  renderOnboardingBanner,
});
const { runLiveDemo } = liveDemo;

async function runSecondaryPanelLoader(key) {
  if (key === "invitations") {
    await fetchInvitations();
    return;
  }
  if (key === "activity") {
    renderEvents();
    return;
  }
  if (key === "billing") {
    await fetchBilling();
    renderBilling();
    return;
  }
  if (key === "health") {
    await fetchHealth();
    renderHealth();
    return;
  }
  if (key === "setup") {
    await fetchSettings();
    renderChecklist();
    renderOnboarding();
    return;
  }
  if (key === "demo") renderSystemSteps();
}

function loadSecondaryPanel(panel, { force = false } = {}) {
  const key = panel?.dataset.adminPanel;
  if (!key) return Promise.resolve();
  if (!force && secondaryPanelLoaded.has(key)) return Promise.resolve();
  if (secondaryPanelPending.has(key)) return secondaryPanelPending.get(key);

  panel.setAttribute("aria-busy", "true");
  panel.dataset.loadState = "loading";
  const pending = runSecondaryPanelLoader(key)
    .then(() => {
      secondaryPanelLoaded.add(key);
      panel.dataset.loadState = "ready";
    })
    .catch((error) => {
      panel.dataset.loadState = "error";
      showLiveStatus("No se pudo cargar este panel");
      console.warn(`[Luenio CRM] Secondary panel "${key}" failed`, error);
      throw error;
    })
    .finally(() => {
      panel.removeAttribute("aria-busy");
      secondaryPanelPending.delete(key);
    });
  secondaryPanelPending.set(key, pending);
  return pending;
}

function refreshLoadedSecondaryPanels() {
  return Promise.allSettled(
    [...secondaryPanelLoaded].map((key) => {
      const panel = document.querySelector(`[data-admin-panel="${key}"]`);
      return loadSecondaryPanel(panel, { force: true });
    }),
  );
}

async function loadDashboard(options = {}) {
  const showSkeleton = options.showSkeleton ?? !state.loadedOnce;
  if (showSkeleton) document.body.classList.add("admin-loading");
  if (options.silent) document.body.classList.add("admin-refreshing");

  if (!state.user) {
    const user = await fetchSession();
    if (!user) return;
  }

  const results = await Promise.allSettled([fetchCrm()]);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    showLiveStatus("Algunos datos no se pudieron sincronizar");
    failed.forEach((result) => console.warn("[Luenio CRM] Dashboard sync failed", result.reason));
  }

  state.loadedOnce = true;
  updateMetrics();
  renderUser();
  renderPipeline();
  renderLeadTable();
  renderDetail();
  renderWorkQueue();
  renderReports();
  renderOnboardingBanner();
  renderBulkBar();
  document.body.classList.remove("admin-loading", "admin-refreshing");
  void refreshLoadedSecondaryPanels();
}

const pipelineBoard = document.querySelector("#pipelineBoard");
pipelineBoard?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-lead]");
  if (!button || !pipelineBoard.contains(button)) return;
  state.selectedLeadId = button.dataset.openLead;
  renderPipeline();
  renderLeadTable();
  renderDetail();
});
pipelineBoard?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-select-lead]");
  if (!input || !pipelineBoard.contains(input)) return;
  toggleLeadSelection(input.dataset.selectLead, input.checked);
  renderPipeline();
  renderLeadTable();
});

const leadTable = document.querySelector("#leadTable");
leadTable?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-table-lead]");
  if (!button || !leadTable.contains(button)) return;
  state.selectedLeadId = button.dataset.openTableLead;
  renderPipeline();
  renderLeadTable();
  renderDetail();
});
leadTable?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-select-lead]");
  if (!input || !leadTable.contains(input)) return;
  toggleLeadSelection(input.dataset.selectLead, input.checked);
  renderPipeline();
  renderLeadTable();
});

document.querySelectorAll("details[data-admin-panel]").forEach((panel) => {
  panel.addEventListener("toggle", () => {
    if (panel.open) {
      loadSecondaryPanel(panel)
        .then(() => animateSecondaryPanel(panel))
        .catch(() => {
          // The panel stays open so the user can retry by closing and reopening it.
        });
    }
  });
});

document.querySelectorAll("[data-report-days]").forEach((button) => {
  button.addEventListener("click", () => {
    state.reportDays = Number(button.dataset.reportDays) === 7 ? 7 : 30;
    document
      .querySelectorAll("[data-report-days]")
      .forEach((item) =>
        item.classList.toggle("active", Number(item.dataset.reportDays) === state.reportDays),
      );
    renderReports();
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderPipeline();
    renderLeadTable();
  });
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter;
    document
      .querySelectorAll("[data-status-filter]")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderPipeline();
    renderLeadTable();
  });
});

let searchDebounce = null;
document.querySelector("#leadSearch")?.addEventListener("input", (event) => {
  state.searchQuery = event.currentTarget.value || "";
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => {
    // Server-side q= on refresh; client filter still applies for demo leads
    loadDashboard({ showSkeleton: false, silent: true }).catch(() => {
      renderPipeline();
      renderLeadTable();
    });
  }, 280);
  renderPipeline();
  renderLeadTable();
});

document.querySelector("#exportLeadsCsv")?.addEventListener("click", () => {
  exportLeadsCsv(filteredLeads());
});

document.querySelector("#importLeadsCsv")?.addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseCrmCsv(text, { maxRows: 100 });
    if (!parsed.rows.length) {
      showLiveStatus(parsed.errors[0] || "CSV vacío o inválido");
      return;
    }
    const { response, data } = await importLeads(parsed.rows);
    if (!response.ok) {
      showLiveStatus(data.error || "No se pudo importar");
      return;
    }
    await loadDashboard({ showSkeleton: false });
    const extra = parsed.errors.length ? ` · ${parsed.errors[0]}` : "";
    showLiveStatus(`Importados ${data.imported || 0} leads (${data.failed || 0} fallidos)${extra}`);
  } catch {
    showLiveStatus("Error al leer el CSV");
  }
});

document.querySelector("#bulkClear")?.addEventListener("click", () => {
  state.selectedIds.clear();
  renderPipeline();
  renderLeadTable();
  renderBulkBar();
});

document.querySelector("#bulkApply")?.addEventListener("click", async () => {
  const leadIds = [...state.selectedIds];
  if (!leadIds.length) return;
  const status = document.querySelector("#bulkStageSelect")?.value || "";
  const tag = String(document.querySelector("#bulkTagInput")?.value || "").trim();
  const assigneeRaw = document.querySelector("#bulkAssigneeSelect")?.value || "";
  let assigneeUserId;
  if (assigneeRaw === "__me__") assigneeUserId = state.user?.id || null;
  else if (assigneeRaw === "__none__") assigneeUserId = null;
  else if (assigneeRaw) assigneeUserId = assigneeRaw;
  if (!status && !tag && assigneeRaw === "") {
    showLiveStatus("Elige etapa, tag o asignación");
    return;
  }
  const button = document.querySelector("#bulkApply");
  if (button) button.disabled = true;
  const { response, data } = await bulkUpdateLeads({
    leadIds,
    status: status || undefined,
    pipelineStage: status || undefined,
    addTags: tag ? [tag] : undefined,
    assigneeUserId: assigneeRaw !== "" ? assigneeUserId : undefined,
  });
  if (button) button.disabled = false;
  if (!response.ok) {
    showLiveStatus(data.error || "Bulk falló");
    return;
  }
  state.selectedIds.clear();
  if (document.querySelector("#bulkTagInput")) document.querySelector("#bulkTagInput").value = "";
  if (document.querySelector("#bulkStageSelect"))
    document.querySelector("#bulkStageSelect").value = "";
  if (document.querySelector("#bulkAssigneeSelect"))
    document.querySelector("#bulkAssigneeSelect").value = "";
  await loadDashboard({ showSkeleton: false });
  showLiveStatus(`Bulk: ${data.updated || 0} actualizados, ${data.failed || 0} fallidos`);
});

document.querySelectorAll("[data-smart-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.smartFilter = button.dataset.smartFilter || "all";
    document
      .querySelectorAll("[data-smart-filter]")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderPipeline();
    renderLeadTable();
    renderWorkQueue();
  });
});

document.querySelector("#previewDigest")?.addEventListener("click", async () => {
  const panel = document.querySelector("#digestPreview");
  const button = document.querySelector("#previewDigest");
  if (button) button.disabled = true;
  try {
    const { response, data } = await previewDigest();
    if (!response.ok) throw new Error(data.error || "No se pudo generar el digest");
    const digest = data.digest || {};
    const totals = digest.totals || {};
    if (panel) {
      panel.hidden = false;
      panel.innerHTML = `
        <strong>Digest del día</strong>
        <p>Leads: ${safeNumber(totals.leads)} · Calientes: ${safeNumber(totals.hot)} · Vencen hoy: ${safeNumber(totals.dueToday)} · Calientes sin tocar: ${safeNumber(totals.staleHot)}</p>
      `;
    }
    showLiveStatus("Vista previa del digest lista");
  } catch (error) {
    if (panel) {
      panel.hidden = false;
      panel.textContent = error.message || "Error al generar digest";
    }
  } finally {
    if (button) button.disabled = false;
  }
});

document.querySelector("#refreshLeads").addEventListener("click", async () => {
  const button = document.querySelector("#refreshLeads");
  button.disabled = true;
  button.textContent = "Sincronizando...";
  showLiveStatus("Sincronizando CRM...");
  await loadDashboard({ showSkeleton: false });
  button.disabled = false;
  button.textContent = "Actualizar CRM";
  showLiveStatus("CRM sincronizado");
});

document.querySelector("#startLiveDemo")?.addEventListener("click", () => {
  const button = document.querySelector("#startLiveDemo");
  if (state.demo.running) return;
  button.disabled = true;
  button.textContent = "Demo en ejecución...";
  runLiveDemo();
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = "Ejecutar Demo en Vivo";
  }, 5200);
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await logout();
  window.location.href = "/login";
});

document.querySelector("#invitationForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-invitation-status]");
  const resultBox = document.querySelector("[data-invitation-result]");
  const data = new FormData(form);
  const payload = {
    businessName: String(data.get("businessName") || "").trim(),
    email: String(data.get("email") || "").trim(),
    role: String(data.get("role") || "client"),
  };
  if (payload.businessName.length < 2 || !payload.email.includes("@")) {
    status.hidden = false;
    status.textContent = "Completa empresa y email.";
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const { response, data: result } = await createInvitation(payload);
  button.disabled = false;
  if (!response.ok) {
    status.hidden = false;
    status.textContent = result.error || "No se pudo crear la invitación.";
    return;
  }
  status.hidden = true;
  resultBox.hidden = false;
  resultBox.innerHTML = `<strong>Enlace generado</strong><input value="${safeText(result.acceptanceUrl)}" readonly aria-label="Enlace de invitación" /><button class="button button-small" type="button" data-copy-invitation>Copiar enlace</button>`;
  resultBox.querySelector("[data-copy-invitation]").addEventListener("click", async () => {
    await navigator.clipboard.writeText(result.acceptanceUrl);
    resultBox.querySelector("[data-copy-invitation]").textContent = "Copiado";
  });
  form.reset();
  await fetchInvitations();
});

renderOnboardingBanner();

loadDashboard({ showSkeleton: true }).catch((error) => {
  document.body.classList.remove("admin-loading", "admin-refreshing");
  document.querySelector("#pipelineBoard").innerHTML =
    `<p>No se pudo cargar el CRM: ${safeText(error.message)}</p>`;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.user) {
    loadDashboard({ silent: true, showSkeleton: false }).catch((error) =>
      console.warn("[Luenio CRM] Refresh after visibility change failed", error),
    );
  }
});
