import { advanceScenario, createDemoScenario } from "./index.js";
import { submitPublicInquiry } from "../api-client.js";
import { protectContactForm } from "../contact-security.js";
import { trackEvent } from "../analytics.js";
import { initThemeControl } from "../theme-control.js";
import { getPublicJourneyBySimulationType, PUBLIC_JOURNEYS } from "../public-journeys.js";

const fontStylesheet = document.querySelector("[data-font-stylesheet]");
if (fontStylesheet?.media === "print") {
  fontStylesheet.media = "all";
}

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

function getValue(scenario, value) {
  if (typeof value === "function") return value(scenario);
  if (value === "lead.message") return scenario.lead.message;
  if (value === "aiReply") return scenario.aiReply;
  return value;
}

function renderIndustryLinks(activeType, selector = "#industryLinks") {
  const nav = document.querySelector(selector);
  if (!nav) return;

  nav.setAttribute("aria-label", "Selector de sector");
  nav.innerHTML = PUBLIC_JOURNEYS.map((journey) => {
    const active = journey.simulationPath.endsWith(`/${activeType}`);
    return `<a class="${active ? "active" : ""}" href="${journey.simulationPath}"${active ? ' aria-current="page"' : ""}>${escapeHtml(journey.label)}</a>`;
  }).join("");

  const activeLink = nav.querySelector('[aria-current="page"]');
  if (activeLink && globalThis.matchMedia("(max-width: 560px)").matches) {
    const centerActiveLink = () => {
      const navBounds = nav.getBoundingClientRect();
      const linkBounds = activeLink.getBoundingClientRect();
      const centeredOffset =
        linkBounds.left + linkBounds.width / 2 - (navBounds.left + navBounds.width / 2);
      nav.scrollLeft = Math.max(0, nav.scrollLeft + centeredOffset);
    };
    centerActiveLink();
    globalThis.requestAnimationFrame(centerActiveLink);
  }
}

function renderCards(selector, items, template) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = items.map(template).join("");
}

function addMessage(selector, role, text) {
  const thread = document.querySelector(selector);
  if (!thread) return;
  thread.querySelector(".chat-empty")?.remove();
  thread.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-bubble ${role}">${escapeHtml(text)}</div>`,
  );
  thread.scrollTop = thread.scrollHeight;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setPipeline(selector, stageIndex) {
  document.querySelectorAll(`${selector} article`).forEach((item, index) => {
    item.classList.toggle("active", index <= stageIndex);
  });
}

function setActiveSequence(selector, activeIndex) {
  document.querySelectorAll(`${selector} article`).forEach((item, index) => {
    item.classList.toggle("active", index <= activeIndex);
  });
}

function createEventRenderer(selector, state) {
  return function addEvent(label, detail) {
    const events = document.querySelector(selector);
    if (!events) return;
    state.events.unshift({ label, detail });
    events.innerHTML = state.events
      .map(
        (event) => `
      <article>
        <strong>${escapeHtml(event.label)}</strong>
        <span>${escapeHtml(event.detail)}</span>
      </article>
    `,
      )
      .join("");
  };
}

function clearTimers(state) {
  state.timers.forEach((timer) => window.clearTimeout(timer));
  state.timers = [];
}

function getCapturePayload(form, scenario) {
  const data = new FormData(form);
  const message = String(data.get("message") || "").trim();
  const journey = getPublicJourneyBySimulationType(scenario.type);
  return {
    name: String(data.get("name") || "").trim(),
    business: String(data.get("business") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    service: journey?.quoteService || "Landing + automatización completa",
    source: `industry_demo_${scenario.type}`,
    message: message || `Vi la demo de ${scenario.label} y quiero convertirla en mi flujo real.`,
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

function renderLeadCapture(config, state) {
  const cta = document.querySelector(config.captureSelector || ".final-cta-section");
  if (!cta || document.querySelector("#demoCaptureForm")) return;

  cta.insertAdjacentHTML(
    "beforeend",
    `
    <form class="demo-capture-form" id="demoCaptureForm" data-state="idle" novalidate>
      <label>Nombre<input name="name" type="text" placeholder="Tu nombre" autocomplete="name" required /></label>
      <label>Negocio<input name="business" type="text" placeholder="Nombre del negocio" autocomplete="organization" required /></label>
      <label>WhatsApp<input name="phone" type="tel" placeholder="+57 300 000 0000" autocomplete="tel" required /></label>
      <label class="wide">Mensaje<textarea name="message" rows="3" placeholder="Qué quieres automatizar después de ver esta demo"></textarea></label>
      <button class="button button-primary wide" type="submit">Cotizar un flujo como este</button>
      <p class="form-status wide" role="status" aria-live="polite" hidden></p>
    </form>
  `,
  );

  const captureForm = cta.querySelector("#demoCaptureForm");
  const securityPromise = protectContactForm(captureForm);
  const getAnalyticsProperties = () => {
    const journey = getPublicJourneyBySimulationType(state.scenario.type);
    return {
      sector: journey?.sector || "",
      demo: journey?.demo || state.scenario.label,
      service: journey?.quoteService || "Landing + automatización completa",
      source: `industry_demo_${state.scenario.type}`,
      cta_location: "demo_capture",
    };
  };
  let formStarted = false;
  captureForm?.addEventListener("input", () => {
    if (formStarted) return;
    formStarted = true;
    trackEvent("quote_form_start", getAnalyticsProperties());
  });
  captureForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.state === "loading") return;
    form.dataset.state = "loading";
    const basePayload = getCapturePayload(form, state.scenario);

    if (
      basePayload.name.length < 2 ||
      basePayload.business.length < 2 ||
      basePayload.phone.replace(/\D/g, "").length < 8
    ) {
      setCaptureStatus(form, "error", "Completa nombre, negocio y WhatsApp para continuar.");
      trackEvent("quote_error", getAnalyticsProperties());
      return;
    }

    setCaptureStatus(form, "loading", "Enviando solicitud...");
    trackEvent("quote_submit", { ...getAnalyticsProperties(), service: basePayload.service });
    try {
      const payload = {
        ...basePayload,
        ...(await securityPromise).payload(),
      };
      await submitPublicInquiry(payload);
      setCaptureStatus(
        form,
        "success",
        "Solicitud recibida. Te contactaremos para adaptar este flujo a tu negocio.",
      );
      trackEvent("quote_success", { ...getAnalyticsProperties(), service: basePayload.service });
      form.reset();
      (await securityPromise).reset();
    } catch {
      setCaptureStatus(
        form,
        "error",
        "No pudimos enviar la solicitud. Inténtalo de nuevo en unos minutos.",
      );
      trackEvent("quote_error", getAnalyticsProperties());
    }
  });
}

export function mountIndustryDemo(config) {
  initThemeControl();
  const state = {
    scenario: createDemoScenario(config.type),
    events: [],
    timers: [],
  };
  const addEvent = createEventRenderer(config.selectors.events, state);

  renderIndustryLinks(config.type, config.selectors.links);

  config.bindInitial?.forEach(({ selector, value }) => {
    setText(selector, getValue(state.scenario, value));
  });

  config.lists?.forEach((list) => {
    const items = state.scenario[list.dataKey] || [];
    renderCards(list.selector, items, (item, index) => list.template(item, index, escapeHtml));
  });
  renderLeadCapture(config, state);

  function applyCrm(update = {}) {
    if (update.leadName)
      setText(config.selectors.leadName, getValue(state.scenario, update.leadName));
    if (update.score) setText(config.selectors.score, getValue(state.scenario, update.score));
    if (typeof update.stageIndex === "number")
      setPipeline(config.selectors.pipeline, update.stageIndex);
    if (typeof update.activeSequence === "number" && config.selectors.sequence) {
      setActiveSequence(config.selectors.sequence, update.activeSequence);
    }
    if (update.fields) {
      update.fields.forEach(({ selector, value }) =>
        setText(selector, getValue(state.scenario, value)),
      );
    }
    if (update.event) addEvent(update.event.label, update.event.detail);
  }

  function resetDemo() {
    state.events = [];
    state.scenario = createDemoScenario(config.type);
    setText(config.selectors.status, config.initialStatus);
    if (config.selectors.chat) setText(config.selectors.chat, "");
    if (config.selectors.events) setText(config.selectors.events, "");
    config.resetFields?.forEach(({ selector, value }) => setText(selector, value));
    applyCrm(config.initialCrm || { stageIndex: 0, activeSequence: -1 });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    clearTimers(state);
    const runButton = document.querySelector(config.selectors.button);
    if (runButton) {
      runButton.disabled = false;
      runButton.textContent = config.runLabel || "Ejecutar demo interactiva";
    }
  });

  function runDemo() {
    clearTimers(state);
    resetDemo();

    const button = document.querySelector(config.selectors.button);
    if (button) {
      button.disabled = true;
      button.textContent = config.runningLabel || "Demo en ejecución...";
    }

    config.steps.forEach((step) => {
      const timer = window.setTimeout(() => {
        const next = advanceScenario(state.scenario, step.advanceIndex);
        state.scenario = next;
        if (step.status) setText(config.selectors.status, getValue(next, step.status));
        if (step.chat)
          addMessage(config.selectors.chat, step.chat.role, getValue(next, step.chat.text));
        if (step.event) addEvent(step.event.label, getValue(next, step.event.detail));
        if (step.crm) applyCrm(step.crm);
        if (step.fields)
          step.fields.forEach(({ selector, value }) => setText(selector, getValue(next, value)));
      }, step.delay);
      state.timers.push(timer);
    });

    const finalTimer = window.setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent = config.readyLabel || "Ejecutar Demo en Vivo";
      }
      setText(config.selectors.status, config.completedStatus);
    }, config.completedDelay || 5100);
    state.timers.push(finalTimer);
  }

  document.querySelector(config.selectors.button)?.addEventListener("click", runDemo);
  if (
    config.autoStart !== false &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const autoStartTimer = window.setTimeout(runDemo, config.autoStartDelay || 650);
    state.timers.push(autoStartTimer);
  }
  return { runDemo, state };
}
