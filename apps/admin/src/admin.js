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
const demoStepTemplate = [
  "Lead received...",
  "Analyzing intent...",
  "Lead scored: HOT / WARM / COLD",
  "Sent to CRM",
  "Automation triggered",
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
    scoreReasons: ["high urgency", "sales intent", "whatsapp automation"],
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
    scoreReasons: ["crm need", "operations intent", "follow-up gap"],
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
    scoreReasons: ["research stage", "low urgency", "education use case"],
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

function showLiveStatus(message = "Live sync active") {
  const element = document.querySelector("#liveStatus");
  if (!element) return;

  element.lastChild.textContent = message;
  element.classList.add("pulse");
  window.clearTimeout(showLiveStatus.timeout);
  showLiveStatus.timeout = window.setTimeout(() => {
    element.lastChild.textContent = "Live sync active";
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
    showLiveStatus(
      `${state.newLeadIds.size} new lead${state.newLeadIds.size > 1 ? "s" : ""} synced`,
    );
  } else if (state.updatedStages.size) {
    showLiveStatus("Pipeline updated");
  } else if (state.newEventIds.size) {
    showLiveStatus("Automation event received");
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
      ? "Storage: Supabase connected"
      : "Storage: local JSON fallback";
    storageBadge.classList.toggle("supabase", isSupabase);
  }
}

function renderUser() {
  const userBox = document.querySelector("#adminUser");
  if (!userBox || !state.user) return;
  userBox.innerHTML = `
    <span>${safeText(state.user.email)}</span>
    <strong>${safeText(state.user.businessName, "Workspace")} - ${safeText(state.user.plan, "starter")}</strong>
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
    setHealthItem("#healthDatabase", "Unknown", "warn");
    return;
  }

  const storageMode = health.storage?.mode || "unknown";
  if (storageMode === "supabase") {
    setHealthItem("#healthDatabase", "Supabase connected", "ok");
  } else if (storageMode === "supabase_required_missing" || !health.httpOk) {
    setHealthItem("#healthDatabase", "Supabase missing", "error");
  } else {
    setHealthItem("#healthDatabase", "Local fallback", "warn");
  }

  setHealthItem(
    "#healthCrmWebhook",
    health.integrations?.crmWebhook ? "Configured" : "Missing",
    health.integrations?.crmWebhook ? "ok" : "warn",
  );
  setHealthItem(
    "#healthWhatsapp",
    health.integrations?.whatsapp ? "Configured" : "Missing",
    health.integrations?.whatsapp ? "ok" : "warn",
  );
  setHealthItem(
    "#healthEmail",
    health.integrations?.email ? "Configured" : "Missing",
    health.integrations?.email ? "ok" : "warn",
  );

  if (note) {
    note.textContent = health.ok
      ? `API online. Storage mode: ${storageMode}.`
      : `System requires attention: ${health.error || "unknown error"}`;
  }
}

function formatDate(value) {
  if (!value) return "unknown";
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
        <strong>Billing unavailable</strong>
        <p>No pudimos cargar los planes. Revisa la sesión o la configuración de Stripe.</p>
      </div>
    `;
    if (status) {
      status.hidden = false;
      status.textContent = state.billing?.error || "Billing API unavailable.";
    }
    return;
  }

  if (status) {
    status.hidden = !state.billing.stripeConfigured;
    status.textContent = state.billing.stripeConfigured
      ? "Stripe checkout is configured. Plan upgrades open securely in Stripe."
      : "";
  }

  grid.innerHTML = Object.entries(state.billing.plans)
    .map(([planId, plan]) => {
      const isCurrent = state.billing.currentPlan === planId;
      const usage = isCurrent ? state.billing.usage : null;
      const usagePercent = Math.max(0, Math.min(100, safeNumber(usage?.percentUsed)));
      return `
      <article>
        <span>${isCurrent ? "Current plan" : "Plan"}</span>
        <strong>${safeText(plan.name)}</strong>
        <p>${safeNumber(plan.monthlyLeadLimit).toLocaleString()} leads/month</p>
        ${
          usage
            ? `
          <div class="usage-card">
            <strong>${safeNumber(usage.used).toLocaleString()} / ${safeNumber(usage.limit).toLocaleString()} leads used</strong>
            <div class="usage-bar" data-usage="${usagePercent}"><span></span></div>
            <p>${safeNumber(usage.remaining).toLocaleString()} remaining. Period ${formatDate(usage.period?.start)} - ${formatDate(usage.period?.end)}.</p>
          </div>
        `
            : ""
        }
        <p>${plan.features.includes("webhooks") ? "Webhooks enabled" : "Webhooks restricted"}</p>
        <button class="button ${isCurrent ? "button-small" : "button-primary button-small"}" type="button" data-plan="${safeText(planId)}" ${isCurrent ? "disabled" : ""}>
          ${isCurrent ? "Active" : "Upgrade"}
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
      button.textContent = "Opening Stripe...";
      if (billingStatus) {
        billingStatus.hidden = false;
        billingStatus.textContent = "Preparing secure checkout...";
      }
      const { response, data: result } = await createCheckout(button.dataset.plan);
      if (response.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      button.disabled = false;
      button.textContent = "Upgrade";
      if (billingStatus) {
        billingStatus.hidden = false;
        billingStatus.textContent = result.error || "Stripe is not configured yet.";
      }
    });
  });
}

function renderChecklist() {
  const checklist = document.querySelector("#setupChecklist");
  if (!checklist || !state.settings?.checklist) return;

  const workspaceItems = state.settings.checklist.map((item) => ({ ...item, group: "Workspace" }));
  const readinessItems = (state.settings.readiness?.checks || []).map((item) => ({
    ...item,
    group: item.severity === "critical" ? "Production" : "Recommended",
  }));

  checklist.innerHTML = [...workspaceItems, ...readinessItems]
    .map(
      (item) => `
    <article class="checklist-item ${item.done ? "done" : "warn"}">
      <span>${safeText(item.group)} - ${item.done ? "Ready" : "Action needed"}</span>
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
  const workspaceName = state.user?.businessName || state.user?.email || "your workspace";
  const items = [
    {
      title: "Welcome screen",
      description: state.user
        ? `Workspace ready for ${workspaceName}.`
        : "Create or access your workspace.",
      done: Boolean(state.user),
    },
    {
      title: "Connect business",
      description:
        state.health?.integrations?.crmWebhook || state.storage !== "checking"
          ? "CRM and storage layer are available."
          : "Connect storage and automation channels.",
      done: state.storage !== "checking",
    },
    {
      title: "Create first lead",
      description: hasLeads
        ? "Lead intake is active in the CRM."
        : "Capture a real lead or run Live Demo Mode.",
      done: hasLeads,
    },
    {
      title: "See system in action",
      description: hasDemo
        ? "Demo flow completed inside this workspace."
        : "Run Live Demo Mode to show the engine working.",
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
          ? `Lead scored: ${activeLead.classification.toUpperCase()}${activeLead.classification === "hot" ? " 🔥" : ""}`
          : label;
      return `
      <article class="${isDone ? "done" : ""} ${isActive ? "active" : ""} ${index === 2 && activeLead ? `score-${safeText(activeLead.classification)}` : ""}">
        <span>${isDone ? "Done" : isActive ? "Running" : "Waiting"}</span>
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
  setDemoStep(0, lead, "Lead received...");

  const schedule = (delay, action) => {
    const timer = window.setTimeout(action, delay);
    state.demo.timers.push(timer);
  };

  schedule(900, () => {
    addDemoEvent("intent.classified", lead, {
      score: lead.score,
      classification: lead.classification,
    });
    setDemoStep(1, lead, "Analyzing intent...");
  });

  schedule(1800, () => {
    setDemoStep(
      2,
      lead,
      `Lead scored: ${lead.classification.toUpperCase()}${lead.classification === "hot" ? " 🔥" : ""}`,
    );
  });

  schedule(2700, () => {
    lead.status = "qualified";
    state.updatedStages = new Set(["qualified"]);
    addDemoEvent("crm.updated", lead, { action: "Lead synced to CRM", pipelineStage: "qualified" });
    state.demoActions.unshift({
      leadId: lead.id,
      workflow: lead.workflow,
      actions: ["create_crm_deal", "assign_sales_owner"],
      restrictedActions: [],
      integrationResults: [{ status: "simulated", provider: "CRM" }],
      internalActionResults: [{ status: "queued", action: "sales_follow_up" }],
    });
    setDemoStep(3, lead, "Sent to CRM");
  });

  schedule(3700, () => {
    lead.status = lead.classification === "hot" ? "contacted" : "qualified";
    state.updatedStages = new Set([lead.status]);
    addDemoEvent("followup.triggered", lead, { actions: ["whatsapp_reply", "sales_task"] });
    addDemoEvent("automation.triggered", lead, { integrations: ["crm", "whatsapp"] });
    setDemoStep(4, lead, "Automation triggered");
  });

  schedule(5000, () => {
    state.demo.running = false;
    state.demo.currentStep = -1;
    showLiveStatus("Live demo completed");
    renderAll();
  });
}

function formatEventTime(event) {
  const timestamp = event.created_at || event.timestamp;
  if (!timestamp) return "just now";
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function formatEventLabel(event, leadName) {
  const labels = {
    "message.received": "Lead message received",
    "intent.classified": "AI intent classified",
    "crm.updated": "CRM record updated",
    "followup.triggered": "Follow-up triggered",
    "automation.triggered": "Automation triggered",
    "lead.created": "Lead created",
    "pipeline.updated": "Pipeline updated",
    "subscription.updated": "Subscription updated",
  };
  const label = labels[event.type] || event.type || "System event";
  return leadName ? `${label} - ${leadName}` : label;
}

function formatEventDetail(event) {
  const payload = event.payload || {};
  if (event.type === "intent.classified")
    return `${payload.classification || "lead"} - score ${payload.score || 0}/100`;
  if (event.type === "crm.updated") return payload.action || payload.pipelineStage || "CRM synced";
  if (event.type === "followup.triggered")
    return `${(payload.actions || []).length} actions queued`;
  if (event.type === "automation.triggered")
    return `${(payload.integrations || []).length} integrations checked`;
  return (
    payload.classification || payload.plan || payload.pipelineStage || payload.source || "system"
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
        <strong>No automation events yet</strong>
        <p>New leads, CRM updates and billing changes will appear here automatically.</p>
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
        <h3>${stage}<span>${stageLeads.length}</span></h3>
        <div class="lead-list">
          ${
            stageLeads
              .map(
                (lead) => `
            <button class="lead-row score-${safeText(lead.classification)} ${lead.demo ? "demo-lead" : ""} ${lead.id === state.selectedLeadId ? "active" : ""} ${state.newLeadIds.has(lead.id) ? "is-new" : ""}" type="button" data-lead-id="${safeText(lead.id)}">
              <span>${safeText(lead.classification)}</span>
              <strong>${safeText(lead.name)}</strong>
              <small>${safeText(lead.business)} - ${safeText(lead.source, "direct")}</small>
              <small>${safeText(lead.service, "No service selected")}</small>
              <small><b class="score-pill">${safeNumber(lead.score)}</b> ${lead.timestamp ? safeText(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(lead.timestamp))) : ""}</small>
            </button>
          `,
              )
              .join("") ||
            `
            <div class="empty-state compact">
              <strong>No leads</strong>
              <p>No matching leads in this stage.</p>
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
        <strong>No matching records</strong>
        <p>Adjust filters or run Live Demo Mode to see the CRM fill in real time.</p>
      </div>
    `;
    return;
  }

  table.innerHTML = `
    <div class="lead-table-row lead-table-head">
      <span>Lead</span>
      <span>Business</span>
      <span>Score</span>
      <span>Stage</span>
      <span>Last activity</span>
    </div>
    ${leads
      .map(
        (lead) => `
      <button class="lead-table-row ${lead.id === state.selectedLeadId ? "active" : ""}" type="button" data-table-lead-id="${safeText(lead.id)}">
        <span><strong>${safeText(lead.name)}</strong><small>${safeText(lead.service, "No service")}</small></span>
        <span>${safeText(lead.business)}${lead.demo ? "<small>Live demo</small>" : ""}</span>
        <span><b class="score-pill score-${safeText(lead.classification)}">${safeNumber(lead.score)}</b>${safeText(lead.classification)}</span>
        <span>${safeText(lead.status)}</span>
        <span>${lead.timestamp ? safeText(new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(lead.timestamp))) : "now"}</span>
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
      <p class="eyebrow">Detalle</p>
      <h2>Selecciona un lead</h2>
      <p>Veras score, fuente, etapa, razones del scoring y acciones automatizadas.</p>
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
    <p class="eyebrow">Lead detail</p>
    <h2>${safeText(lead.name)}</h2>
    <p>${safeText(lead.business)} - ${safeText(lead.phone)}</p>
    <div class="detail-grid">
      <article><span>Score</span><strong>${safeNumber(lead.score)}/100 - ${safeText(lead.classification)}</strong></article>
      <article><span>Pipeline</span><strong>${safeText(lead.status)}</strong></article>
      <article><span>Source</span><strong>${safeText(lead.source, "direct")}</strong></article>
      <article><span>Interest</span><strong>${safeText(lead.service)}</strong></article>
      <article><span>Workflow</span><strong>${safeText(lead.workflow || action?.workflow, "pending")}</strong></article>
      <article><span>Reasons</span><strong>${safeText((lead.scoreReasons || []).join(", "), "No reasons stored")}</strong></article>
    </div>
    <div class="actions-history">
      <strong>Actions history</strong>
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
          : "<p>No actions recorded yet.</p>"
      }
    </div>
    ${
      restrictedActions.length
        ? `
      <div class="upgrade-callout">
        <strong>Upgrade unlocks automation</strong>
        <p>${safeText(restrictedActions.join(", "))} are restricted on your current plan.</p>
        <button class="button button-primary button-small" type="button" data-open-billing>View billing</button>
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
    button.textContent = "Updating pipeline...";
    showLiveStatus(`Moving lead to ${nextStage}`);
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
      showLiveStatus("Demo pipeline updated");
      return;
    }
    await updatePipeline({ leadId: lead.id, status: nextStage, pipelineStage: nextStage });
    state.updatedStages = new Set([nextStage]);
    await loadDashboard();
    state.selectedLeadId = lead.id;
    showLiveStatus("Pipeline updated");
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
    showLiveStatus("Some data failed to sync");
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
  button.textContent = "Syncing...";
  showLiveStatus("Syncing CRM...");
  await loadDashboard({ showSkeleton: false });
  button.disabled = false;
  button.textContent = "Actualizar CRM";
  showLiveStatus("CRM synced");
});

document.querySelector("#startLiveDemo")?.addEventListener("click", () => {
  const button = document.querySelector("#startLiveDemo");
  if (state.demo.running) return;
  button.disabled = true;
  button.textContent = "Demo running...";
  runLiveDemo();
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = "Live Demo Mode";
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
