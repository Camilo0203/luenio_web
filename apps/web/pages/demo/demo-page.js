import { advanceScenario, createDemoScenario, demoTypes } from "../../src/demo-engine/index.js";
import { submitPublicInquiry } from "../../src/api-client.js";

const root = document.querySelector("[data-demo-type]");
const selectedType = root?.dataset.demoType || "restaurants";
const scenario = createDemoScenario(selectedType);

const state = {
  scenario,
  currentStep: -1,
  events: [],
  timerIds: [],
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

function renderIndustryLinks() {
  const nav = document.querySelector("#industryLinks");
  if (!nav) return;

  nav.innerHTML = demoTypes
    .map((type) => {
      const href = type === "restaurants" ? "/demo/restaurants" : `/demo/${type}`;
      const isActive = type === selectedType;
      return `<a class="${isActive ? "active" : ""}" href="${href}">${escapeHtml(createDemoScenario(type).label)}</a>`;
    })
    .join("");
}

function renderScenario(nextScenario = state.scenario) {
  const lead = nextScenario.lead;
  document.querySelector("#demoLabel").textContent = nextScenario.label;
  document.querySelector("#demoHeadline").textContent = nextScenario.headline;
  document.querySelector("#leadName").textContent = lead.name;
  document.querySelector("#leadBusiness").textContent = lead.business;
  document.querySelector("#leadMessage").textContent = lead.message;
  document.querySelector("#leadScore").textContent = `${lead.score}/100`;
  document.querySelector("#leadScore").className = `demo-score ${lead.classification}`;
  document.querySelector("#leadStage").textContent = lead.stage;
  document.querySelector("#leadSource").textContent = lead.source;

  const steps = document.querySelector("#demoSteps");
  steps.innerHTML = nextScenario.steps
    .map((step, index) => {
      const isDone = state.currentStep > index;
      const isActive = state.currentStep === index;
      return `
      <article class="${isDone ? "done" : ""} ${isActive ? "active" : ""}">
        <span>${isDone ? "Completado" : isActive ? "En ejecución" : "Esperando"}</span>
        <strong>${escapeHtml(step.label)}</strong>
      </article>
    `;
    })
    .join("");

  const pipeline = document.querySelector("#demoPipeline");
  const stages = ["new", "qualified", "contacted", "converted"];
  pipeline.innerHTML = stages
    .map(
      (stage) => `
    <article class="${lead.stage === stage ? "active" : ""}">
      <span>${escapeHtml(stage)}</span>
      ${lead.stage === stage ? `<strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.service)}</small>` : "<small>Sin lead</small>"}
    </article>
  `,
    )
    .join("");

  const feed = document.querySelector("#demoFeed");
  feed.innerHTML = state.events.length
    ? state.events
        .map(
          (event) => `
    <article>
      <strong>${escapeHtml(event.label)}</strong>
      <span>${escapeHtml(event.detail)}</span>
    </article>
  `,
        )
        .join("")
    : "<p>Ejecuta la demo para ver el registro de automatización.</p>";
}

function renderLeadCapture() {
  const cta = document.querySelector(".final-cta-section");
  if (!cta || document.querySelector("#demoCaptureForm")) return;

  cta.insertAdjacentHTML(
    "beforeend",
    `
    <form class="demo-capture-form" id="demoCaptureForm" novalidate>
      <label>Nombre<input name="name" type="text" placeholder="Tu nombre" autocomplete="name" required /></label>
      <label>Negocio<input name="business" type="text" placeholder="Nombre del negocio" autocomplete="organization" required /></label>
      <label>WhatsApp<input name="phone" type="tel" placeholder="+57 300 000 0000" autocomplete="tel" required /></label>
      <input name="service" type="hidden" value="${escapeHtml(state.scenario.label)}" />
      <input name="source" type="hidden" value="industry_demo_${escapeHtml(selectedType)}" />
      <label class="wide">Mensaje<textarea name="message" rows="3" placeholder="Qué quieres automatizar después de ver esta demo"></textarea></label>
      <button class="button button-primary wide" type="submit">Convertir esta demo en mi CRM</button>
      <p class="form-status wide" role="status" aria-live="polite" hidden></p>
    </form>
  `,
  );

  cta.querySelector("#demoCaptureForm")?.addEventListener("submit", submitDemoCapture);
}

function getCapturePayload(form) {
  const data = new FormData(form);
  const message = String(data.get("message") || "").trim();
  return {
    name: String(data.get("name") || "").trim(),
    business: String(data.get("business") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    service: String(data.get("service") || "").trim(),
    source: String(data.get("source") || "").trim(),
    message: message || `Vi la demo de ${state.scenario.label} y quiero automatizar mi negocio.`,
  };
}

function setCaptureStatus(form, stateName, message) {
  const button = form.querySelector("button[type='submit']");
  const status = form.querySelector(".form-status");
  form.dataset.state = stateName;
  if (button) {
    button.disabled = stateName === "loading";
    button.textContent = stateName === "loading" ? "Enviando..." : "Convertir esta demo en mi CRM";
  }
  if (status) {
    status.hidden = !message;
    status.textContent = message || "";
  }
}

async function submitDemoCapture(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = getCapturePayload(form);

  if (
    payload.name.length < 2 ||
    payload.business.length < 2 ||
    payload.phone.replace(/\D/g, "").length < 8
  ) {
    setCaptureStatus(form, "error", "Completa nombre, negocio y WhatsApp para continuar.");
    return;
  }

  setCaptureStatus(form, "loading", "Enviando solicitud...");
  try {
    await submitPublicInquiry(payload);
    setCaptureStatus(
      form,
      "success",
      "Solicitud recibida. Te contactaremos para convertir esta demo en tu flujo real.",
    );
    form.reset();
  } catch {
    setCaptureStatus(
      form,
      "error",
      "No pudimos enviar la solicitud. Inténtalo de nuevo en unos minutos.",
    );
  }
}

function clearTimers() {
  state.timerIds.forEach((timerId) => window.clearTimeout(timerId));
  state.timerIds = [];
}

function runDemo() {
  clearTimers();
  state.currentStep = -1;
  state.events = [];
  state.scenario = createDemoScenario(selectedType);
  renderScenario();

  const button = document.querySelector("#runDemo");
  button.disabled = true;
  button.textContent = "Demo en ejecución...";

  state.scenario.steps.forEach((_, index) => {
    const timerId = window.setTimeout(() => {
      const nextScenario = advanceScenario(state.scenario, index);
      state.currentStep = index;
      state.scenario = nextScenario;
      state.events.unshift(nextScenario.event);
      renderScenario(nextScenario);

      if (index === state.scenario.steps.length - 1) {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = "Ejecutar demo interactiva";
        }, 650);
      }
    }, index * 900);
    state.timerIds.push(timerId);
  });
}

renderIndustryLinks();
renderScenario();
renderLeadCapture();
document.querySelector("#runDemo")?.addEventListener("click", runDemo);
