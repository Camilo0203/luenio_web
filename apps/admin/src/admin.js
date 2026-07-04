import {
  createCheckout,
  getBilling,
  getHealth,
  getLeads,
  getSession,
  getSettings,
  logout,
  updatePipeline,
} from "./api-client.js";

const stages = ["new", "qualified", "contacted", "converted"];

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };
const STAGE_LABELS = {
  new: "Nuevo",
  qualified: "Calificado",
  contacted: "Contactado",
  converted: "Convertido",
};

function classificationLabel(value) {
  return CLASSIFICATION_LABELS[value] || value;
}

function stageLabel(value) {
  return STAGE_LABELS[value] || value;
}

const demoStepTemplate = [
  "Lead recibido...",
  "Analizando intención...",
  "Lead calificado: CALIENTE / TIBIO / FRÍO",
  "Enviado al CRM",
  "Automatización activada",
];
const demoLeads = [
  {
    name: "Camila Torres",
    business: "Nova Studio",
    phone: "+57 300 421 9090",
    service: "Automatización de WhatsApp",
    message: "Quiero responder clientes y agendar más rápido esta semana.",
    source: "live_demo",
    score: 92,
    classification: "hot",
    scoreReasons: ["alta urgencia", "intención de compra", "automatización de whatsapp"],
    workflow: "whatsapp_qualification",
  },
  {
    name: "Andrés Molina",
    business: "LegalHub",
    phone: "+57 310 884 1200",
    service: "CRM automatizado",
    message: "Necesitamos ordenar prospectos y seguimiento comercial.",
    source: "live_demo",
    score: 74,
    classification: "warm",
    scoreReasons: ["necesidad de crm", "intención operativa", "falta de seguimiento"],
    workflow: "crm_sync",
  },
  {
    name: "Sofía Rivas",
    business: "EducaPro",
    phone: "+57 315 330 7711",
    service: "Chatbot IA para ventas",
    message: "Estoy revisando opciones para automatizar información de cursos.",
    source: "live_demo",
    score: 48,
    classification: "cold",
    scoreReasons: ["etapa de investigación", "baja urgencia", "caso de uso educativo"],
    workflow: "nurture_sequence",
  },
];

const state = {
  leads: [],
  demoLeads: [],
  actions: [],
  demoActions: [],
  notifications: [],
  events: [],
  demoEvents: [],
  storage: "checking",
  health: null,
  user: null,
  billing: null,
  settings: null,
  selectedLeadId: null,
  filter: "all",
  statusFilter: "all",
  hydrated: false,
  loadedOnce: false,
  refreshing: false,
  newEventIds: new Set(),
  newLeadIds: new Set(),
  updatedStages: new Set(),
  demo: {
    active: false,
    running: false,
    currentLeadId: null,
    currentStep: -1,
    selectedIndex: 0,
    timers: [],
  },
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function safeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return escapeHtml(normalized || fallback);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getClassification(lead) {
  return lead.classification || (lead.score >= 80 ? "hot" : lead.score >= 60 ? "warm" : "cold");
}

function normalizeLeadFromApi(lead) {
  return {
    id: lead.id,
    name: lead.name,
    business: lead.business,
    phone: lead.phone,
    service: lead.service,
    message: lead.message,
    source: lead.source,
    score: lead.score,
    classification: getClassification(lead),
    status: lead.pipeline_stage || lead.pipelineStage || lead.status || "new",
    timestamp: lead.created_at || lead.timestamp,
    scoreReasons: lead.score_reasons || lead.scoreReasons || [],
    workflow: lead.workflow,
  };
}

function getWorkspaceLeads() {
  return [...state.demoLeads, ...state.leads];
}

function getWorkspaceEvents() {
  return [...state.demoEvents, ...state.events];
}

function getWorkspaceActions() {
  return [...state.demoActions, ...state.actions];
}

function isDemoLead(leadId) {
  return String(leadId || "").startsWith("demo_lead_");
}

function createDemoEvent(type, lead, payload = {}) {
  return {
    id: `demo_event_${Date.now()}_${type}_${lead.id}`,
    type,
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    payload: {
      source: "live_demo",
      classification: lead.classification,
      score: lead.score,
      pipelineStage: lead.status,
      ...payload,
    },
  };
}

function createDemoLead(template, stage = "new") {
  const id = `demo_lead_${Date.now()}_${state.demo.selectedIndex}`;
  return {
    ...template,
    id,
    status: stage,
    timestamp: new Date().toISOString(),
    demo: true,
  };
}

function getEventId(event) {
  return (
    event.id ||
    `${event.type}_${event.created_at || event.timestamp || ""}_${event.lead_id || event.leadId || ""}`
  );
}

function showLiveStatus(message = "Sincronización en vivo activa") {
  const element = document.querySelector("#liveStatus");
  if (!element) return;

  element.lastChild.textContent = message;
  element.classList.add("pulse");
  window.clearTimeout(showLiveStatus.timeout);
  showLiveStatus.timeout = window.setTimeout(() => {
    element.lastChild.textContent = "Sincronización en vivo activa";
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
  const { response, data } = await getLeads();
  if (!response.ok) throw new Error(`CRM request failed ${response.status}`);

  const nextLeads = (data.leads || []).map(normalizeLeadFromApi);
  const nextEvents = data.events || [];
  detectLiveChanges(nextLeads, nextEvents);
  state.leads = nextLeads;
  state.actions = data.actions || [];
  state.notifications = data.notifications || [];
  state.events = nextEvents;
  state.storage = data.storage || "unknown";
  state.hydrated = true;
  return data;
}

async function fetchSession() {
  const { response, data } = await getSession();
  if (!response.ok || !data.authenticated) {
    window.location.href = "/login";
    return null;
  }
  state.user = data.user;
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

function filteredLeads() {
  return getWorkspaceLeads().filter((lead) => {
    const matchesScore = state.filter === "all" || lead.classification === state.filter;
    const matchesStatus = state.statusFilter === "all" || lead.status === state.statusFilter;
    return matchesScore && matchesStatus;
  });
}

function updateMetrics() {
  const leads = getWorkspaceLeads();
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

  const storageBadge = document.querySelector("#storageBadge");
  if (storageBadge) {
    const isSupabase = state.storage === "supabase";
    storageBadge.textContent = isSupabase
      ? "Almacenamiento: Supabase conectado"
      : "Almacenamiento: respaldo JSON local";
    storageBadge.classList.toggle("supabase", isSupabase);
  }
}

function renderUser() {
  const userBox = document.querySelector("#adminUser");
  if (!userBox || !state.user) return;
  userBox.innerHTML = `
    <span>${safeText(state.user.email)}</span>
    <strong>${safeText(state.user.businessName, "Espacio de trabajo")} - ${safeText(state.user.plan, "starter")}</strong>
  `;
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

  const storageMode = health.storage?.mode || "desconocido";
  if (storageMode === "supabase") {
    setHealthItem("#healthDatabase", "Supabase conectado", "ok");
  } else if (storageMode === "supabase_required_missing" || !health.httpOk) {
    setHealthItem("#healthDatabase", "Supabase no configurado", "error");
  } else {
    setHealthItem("#healthDatabase", "Respaldo local", "warn");
  }

  setHealthItem(
    "#healthCrmWebhook",
    health.integrations?.crmWebhook ? "Configurado" : "No configurado",
    health.integrations?.crmWebhook ? "ok" : "warn",
  );
  setHealthItem(
    "#healthWhatsapp",
    health.integrations?.whatsapp ? "Configurado" : "No configurado",
    health.integrations?.whatsapp ? "ok" : "warn",
  );
  setHealthItem(
    "#healthEmail",
    health.integrations?.email ? "Configurado" : "No configurado",
    health.integrations?.email ? "ok" : "warn",
  );

  if (note) {
    note.textContent = health.ok
      ? `API en línea. Modo de almacenamiento: ${storageMode}.`
      : `El sistema requiere atención: ${health.error || "error desconocido"}`;
  }
}

function formatDate(value) {
  if (!value) return "desconocido";
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function renderBilling() {
  const grid = document.querySelector("#billingGrid");
  const status = document.querySelector("#billingStatus");
  if (!grid) return;

  if (!state.billing?.plans) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>Facturación no disponible</strong>
        <p>No pudimos cargar los planes. Revisa la sesión o la configuración de Stripe.</p>
      </div>
    `;
    if (status) {
      status.hidden = false;
      status.textContent = state.billing?.error || "La API de facturación no está disponible.";
    }
    return;
  }

  if (status) {
    status.hidden = !state.billing.stripeConfigured;
    status.textContent = state.billing.stripeConfigured
      ? "El checkout de Stripe está configurado. Las mejoras de plan se abren de forma segura en Stripe."
      : "";
  }

  grid.innerHTML = Object.entries(state.billing.plans)
    .map(([planId, plan]) => {
      const isCurrent = state.billing.currentPlan === planId;
      const usage = isCurrent ? state.billing.usage : null;
      const usagePercent = Math.max(0, Math.min(100, safeNumber(usage?.percentUsed)));
      return `
      <article>
        <span>${isCurrent ? "Plan actual" : "Plan"}</span>
        <strong>${safeText(plan.name)}</strong>
        <p>${safeNumber(plan.monthlyLeadLimit).toLocaleString()} leads/mes</p>
        ${
          usage
            ? `
          <div class="usage-card">
            <strong>${safeNumber(usage.used).toLocaleString()} / ${safeNumber(usage.limit).toLocaleString()} leads usados</strong>
            <div class="usage-bar" data-usage="${usagePercent}"><span></span></div>
            <p>${safeNumber(usage.remaining).toLocaleString()} restantes. Periodo ${formatDate(usage.period?.start)} - ${formatDate(usage.period?.end)}.</p>
          </div>
        `
            : ""
        }
        <p>${plan.features.includes("webhooks") ? "Webhooks habilitados" : "Webhooks restringidos"}</p>
        <button class="button ${isCurrent ? "button-small" : "button-primary button-small"}" type="button" data-plan="${safeText(planId)}" ${isCurrent ? "disabled" : ""}>
          ${isCurrent ? "Activo" : "Mejorar plan"}
        </button>
      </article>
    `;
    })
    .join("");

  grid.querySelectorAll("[data-usage]").forEach((usageBar) => {
    usageBar.style.setProperty("--usage", `${safeNumber(usageBar.dataset.usage)}%`);
  });

  grid.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      const billingStatus = document.querySelector("#billingStatus");
      button.disabled = true;
      button.textContent = "Abriendo Stripe...";
      if (billingStatus) {
        billingStatus.hidden = false;
        billingStatus.textContent = "Preparando checkout seguro...";
      }
      const { response, data: result } = await createCheckout(button.dataset.plan);
      if (response.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      button.disabled = false;
      button.textContent = "Mejorar plan";
      if (billingStatus) {
        billingStatus.hidden = false;
        billingStatus.textContent = result.error || "Stripe aún no está configurado.";
      }
    });
  });
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
      description:
        state.health?.integrations?.crmWebhook || state.storage !== "checking"
          ? "El CRM y la capa de almacenamiento están disponibles."
          : "Conecta el almacenamiento y los canales de automatización.",
      done: state.storage !== "checking",
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

function renderAll() {
  updateMetrics();
  renderOnboarding();
  renderEvents();
  renderPipeline();
  renderLeadTable();
  renderDetail();
  renderSystemSteps();
}

function clearDemoTimers() {
  state.demo.timers.forEach((timer) => window.clearTimeout(timer));
  state.demo.timers = [];
}

function addDemoEvent(type, lead, payload = {}) {
  const event = createDemoEvent(type, lead, payload);
  state.demoEvents.unshift(event);
  state.newEventIds.add(getEventId(event));
  return event;
}

function setDemoStep(index, lead, statusMessage) {
  state.demo.currentStep = index;
  if (statusMessage) showLiveStatus(statusMessage);
  if (lead) lead.timestamp = new Date().toISOString();
  renderAll();
}

function runLiveDemo() {
  if (state.demo.running) return;

  clearDemoTimers();
  state.demo.active = true;
  state.demo.running = true;
  state.demo.currentStep = 0;
  state.demo.selectedIndex = (state.demo.selectedIndex + 1) % demoLeads.length;
  state.newLeadIds = new Set();
  state.newEventIds = new Set();
  state.updatedStages = new Set();

  const lead = createDemoLead(demoLeads[state.demo.selectedIndex], "new");
  state.demo.currentLeadId = lead.id;
  state.demoLeads.unshift(lead);
  state.newLeadIds.add(lead.id);
  state.selectedLeadId = lead.id;
  addDemoEvent("message.received", lead, { source: "whatsapp" });
  setDemoStep(0, lead, "Lead recibido...");

  const schedule = (delay, action) => {
    const timer = window.setTimeout(action, delay);
    state.demo.timers.push(timer);
  };

  schedule(900, () => {
    addDemoEvent("intent.classified", lead, {
      score: lead.score,
      classification: lead.classification,
    });
    setDemoStep(1, lead, "Analizando intención...");
  });

  schedule(1800, () => {
    setDemoStep(
      2,
      lead,
      `Lead calificado: ${classificationLabel(lead.classification)}${lead.classification === "hot" ? " 🔥" : ""}`,
    );
  });

  schedule(2700, () => {
    lead.status = "qualified";
    state.updatedStages = new Set(["qualified"]);
    addDemoEvent("crm.updated", lead, {
      action: "Lead sincronizado con el CRM",
      pipelineStage: "qualified",
    });
    state.demoActions.unshift({
      leadId: lead.id,
      workflow: lead.workflow,
      actions: ["create_crm_deal", "assign_sales_owner"],
      restrictedActions: [],
      integrationResults: [{ status: "simulated", provider: "CRM" }],
      internalActionResults: [{ status: "queued", action: "sales_follow_up" }],
    });
    setDemoStep(3, lead, "Enviado al CRM");
  });

  schedule(3700, () => {
    lead.status = lead.classification === "hot" ? "contacted" : "qualified";
    state.updatedStages = new Set([lead.status]);
    addDemoEvent("followup.triggered", lead, { actions: ["whatsapp_reply", "sales_task"] });
    addDemoEvent("automation.triggered", lead, { integrations: ["crm", "whatsapp"] });
    setDemoStep(4, lead, "Automatización activada");
  });

  schedule(5000, () => {
    state.demo.running = false;
    state.demo.currentStep = -1;
    showLiveStatus("Demo en vivo completada");
    renderAll();
  });
}

function formatEventTime(event) {
  const timestamp = event.created_at || event.timestamp;
  if (!timestamp) return "justo ahora";
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
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
      <section class="pipeline-column ${state.updatedStages.has(stage) ? "updated" : ""}">
        <h3>${safeText(stageLabel(stage))}<span>${stageLeads.length}</span></h3>
        <div class="lead-list">
          ${
            stageLeads
              .map(
                (lead) => `
            <button class="lead-row score-${safeText(lead.classification)} ${lead.demo ? "demo-lead" : ""} ${lead.id === state.selectedLeadId ? "active" : ""} ${state.newLeadIds.has(lead.id) ? "is-new" : ""}" type="button" data-lead-id="${safeText(lead.id)}">
              <span>${safeText(classificationLabel(lead.classification))}</span>
              <strong>${safeText(lead.name)}</strong>
              <small>${safeText(lead.business)} - ${safeText(lead.source, "directo")}</small>
              <small>${safeText(lead.service, "Sin servicio seleccionado")}</small>
              <small><b class="score-pill">${safeNumber(lead.score)}</b> ${lead.timestamp ? safeText(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(lead.timestamp))) : ""}</small>
            </button>
          `,
              )
              .join("") ||
            `
            <div class="empty-state compact">
              <strong>Sin leads</strong>
              <p>No hay leads que coincidan en esta etapa.</p>
            </div>
          `
          }
        </div>
      </section>
    `;
    })
    .join("");

  board.querySelectorAll("[data-lead-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLeadId = button.dataset.leadId;
      renderPipeline();
      renderDetail();
    });
  });
}

function renderLeadTable() {
  const table = document.querySelector("#leadTable");
  if (!table) return;
  const leads = filteredLeads();

  if (!leads.length) {
    table.innerHTML = `
      <div class="empty-state">
        <strong>Sin registros coincidentes</strong>
        <p>Ajusta los filtros o ejecuta la Demo en Vivo para ver el CRM llenarse en tiempo real.</p>
      </div>
    `;
    return;
  }

  table.innerHTML = `
    <div class="lead-table-row lead-table-head">
      <span>Lead</span>
      <span>Negocio</span>
      <span>Score</span>
      <span>Etapa</span>
      <span>Última actividad</span>
    </div>
    ${leads
      .map(
        (lead) => `
      <button class="lead-table-row ${lead.id === state.selectedLeadId ? "active" : ""}" type="button" data-table-lead-id="${safeText(lead.id)}">
        <span><strong>${safeText(lead.name)}</strong><small>${safeText(lead.service, "Sin servicio")}</small></span>
        <span>${safeText(lead.business)}${lead.demo ? "<small>Demo en vivo</small>" : ""}</span>
        <span><b class="score-pill score-${safeText(lead.classification)}">${safeNumber(lead.score)}</b>${safeText(classificationLabel(lead.classification))}</span>
        <span>${safeText(stageLabel(lead.status))}</span>
        <span>${lead.timestamp ? safeText(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(lead.timestamp))) : "ahora"}</span>
      </button>
    `,
      )
      .join("")}
  `;

  table.querySelectorAll("[data-table-lead-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLeadId = button.dataset.tableLeadId;
      renderPipeline();
      renderLeadTable();
      renderDetail();
    });
  });
}

function renderDetail() {
  const detail = document.querySelector("#leadDetail");
  const lead = getWorkspaceLeads().find((item) => item.id === state.selectedLeadId);

  if (!lead) {
    detail.innerHTML = `
      <p class="eyebrow">Detalle del lead</p>
      <h2>Selecciona un lead</h2>
      <p>Verás score, fuente, etapa, razones del scoring y acciones automatizadas.</p>
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
    </div>
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
    document
      .querySelector(".billing-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      showLiveStatus("Pipeline de demo actualizado");
      return;
    }
    await updatePipeline({ leadId: lead.id, status: nextStage, pipelineStage: nextStage });
    state.updatedStages = new Set([nextStage]);
    await loadDashboard();
    state.selectedLeadId = lead.id;
    showLiveStatus("Pipeline actualizado");
    renderDetail();
  });
}

async function loadDashboard(options = {}) {
  const showSkeleton = options.showSkeleton ?? !state.loadedOnce;
  if (showSkeleton) document.body.classList.add("admin-loading");
  if (options.silent) document.body.classList.add("admin-refreshing");

  if (!state.user) {
    const user = await fetchSession();
    if (!user) return;
  }

  const results = await Promise.allSettled([
    fetchHealth(),
    fetchCrm(),
    fetchBilling(),
    fetchSettings(),
  ]);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    showLiveStatus("Algunos datos no se pudieron sincronizar");
    failed.forEach((result) => console.warn("[Luenio CRM] Dashboard sync failed", result.reason));
  }

  document.body.classList.remove("admin-loading", "admin-refreshing");
  state.loadedOnce = true;
  updateMetrics();
  renderUser();
  renderHealth();
  renderBilling();
  renderChecklist();
  renderOnboarding();
  renderEvents();
  renderPipeline();
  renderLeadTable();
  renderDetail();
  renderSystemSteps();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderPipeline();
  });
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter;
    document
      .querySelectorAll("[data-status-filter]")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderPipeline();
  });
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

loadDashboard({ showSkeleton: true }).catch((error) => {
  document.querySelector("#pipelineBoard").innerHTML =
    `<p>No se pudo cargar el CRM: ${safeText(error.message)}</p>`;
});

window.setInterval(() => {
  if (document.visibilityState === "visible" && state.user) {
    loadDashboard({ silent: true, showSkeleton: false }).catch((error) =>
      console.warn("[Luenio CRM] Live refresh failed", error),
    );
  }
}, 5000);
