import { advanceScenario, createDemoScenario } from "../../src/demo-engine/index.js";
import { submitPublicInquiry } from "../../src/api-client.js";
import { protectContactForm } from "../../src/contact-security.js";
import { initAnalytics, trackEvent } from "../../src/analytics.js";
import { getPublicJourneyBySimulationType, PUBLIC_JOURNEYS } from "../../src/public-journeys.js";
import { initThemeControl } from "../../src/theme-control.js";

initThemeControl();

const root = document.querySelector("[data-demo-type]");
const selectedType = root?.dataset.demoType || "restaurants";
const scenario = createDemoScenario(selectedType);
const journey = getPublicJourneyBySimulationType(selectedType);

const state = {
  scenario,
  currentStep: -1,
  events: [],
  timerIds: [],
};
let captureSecurity;

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

  nav.setAttribute("aria-label", "Selector de sector");
  nav.innerHTML = PUBLIC_JOURNEYS.map((journey) => {
    const isActive = journey.simulationPath.endsWith(`/${selectedType}`);
    return `<a class="${isActive ? "active" : ""}" href="${journey.simulationPath}"${isActive ? ' aria-current="page"' : ""}>${escapeHtml(journey.label)}</a>`;
  }).join("");
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
      <input name="service" type="hidden" value="${escapeHtml(journey?.quoteService || "Landing + automatización completa")}" />
      <input name="source" type="hidden" value="industry_demo_${escapeHtml(selectedType)}" />
      <label class="wide">Mensaje<textarea name="message" rows="3" placeholder="Qué quieres automatizar después de ver esta demo"></textarea></label>
      <button class="button button-primary wide" type="submit">Cotizar un flujo como este</button>
      <p class="form-status wide" role="status" aria-live="polite" hidden></p>
    </form>
  `,
  );

  const captureForm = cta.querySelector("#demoCaptureForm");
  captureSecurity = protectContactForm(captureForm);
  captureForm?.addEventListener("submit", submitDemoCapture);
}

function getCapturePayload(form) {
  const data = new FormData(form);
  const message = String(data.get("message") || "").trim();
  return {
    name: String(data.get("name") || "").trim(),
    business: String(data.get("business") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    service: journey?.quoteService || "Landing + automatización completa",
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
    button.textContent = stateName === "loading" ? "Enviando..." : "Cotizar un flujo como este";
  }
  if (status) {
    status.hidden = !message;
    status.textContent = message || "";
  }
}

async function submitDemoCapture(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.state === "loading") return;
  form.dataset.state = "loading";
  const basePayload = getCapturePayload(form);

  if (
    basePayload.name.length < 2 ||
    basePayload.business.length < 2 ||
    basePayload.phone.replace(/\D/g, "").length < 8
  ) {
    setCaptureStatus(form, "error", "Completa nombre, negocio y WhatsApp para continuar.");
    trackEvent("quote_error", {
      sector: journey?.sector,
      demo: journey?.demo,
      service: basePayload.service,
      source: `industry_demo_${selectedType}`,
      cta_location: "demo_capture",
    });
    return;
  }

  setCaptureStatus(form, "loading", "Enviando solicitud...");
  trackEvent("quote_submit", {
    sector: journey?.sector,
    demo: journey?.demo,
    source: `industry_demo_${selectedType}`,
    service: basePayload.service,
    cta_location: "demo_capture",
  });
  try {
    const payload = {
      ...basePayload,
      ...(await captureSecurity).payload(),
    };
    await submitPublicInquiry(payload);
    setCaptureStatus(
      form,
      "success",
      "Solicitud recibida. Te contactaremos para adaptar este flujo a tu negocio.",
    );
    trackEvent("quote_success", {
      sector: journey?.sector,
      demo: journey?.demo,
      source: `industry_demo_${selectedType}`,
      service: basePayload.service,
      cta_location: "demo_capture",
    });
    form.reset();
    (await captureSecurity).reset();
  } catch {
    trackEvent("quote_error", {
      sector: journey?.sector,
      demo: journey?.demo,
      service: basePayload.service,
      source: `industry_demo_${selectedType}`,
      cta_location: "demo_capture",
    });
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  clearTimers();
  const button = document.querySelector("#runDemo");
  if (button) {
    button.disabled = false;
    button.textContent = "Ejecutar demo interactiva";
  }
});

renderIndustryLinks();
renderScenario();
renderLeadCapture();
document.querySelector("#runDemo")?.addEventListener("click", runDemo);
void initAnalytics();
