import { initAnalytics, trackEvent } from "./analytics.js";
import { brandConfig } from "./brand-config.js";
import { buildQuoteUrl } from "./journey-context.js";
import { getPublicJourneyBySimulationType } from "./public-journeys.js";

const root = document.querySelector(".demo-page[data-demo-type]");
const runButton = root?.querySelector('button[id^="run"]');

if (root && runButton) {
  const type = root.dataset.demoType;
  const journey = getPublicJourneyBySimulationType(type);
  const stateLabel = document.createElement("p");
  stateLabel.className = "simulation-runtime-state";
  stateLabel.dataset.simulationStateLabel = "";
  stateLabel.setAttribute("role", "status");
  stateLabel.setAttribute("aria-live", "polite");
  stateLabel.textContent = "Estado: Lista";
  stateLabel.dataset.state = "ready";
  runButton.insertAdjacentElement("afterend", stateLabel);
  const analyticsProperties = {
    simulation: type,
    sector: journey?.sector || "",
    demo: journey?.demo || "",
  };
  let userInitiatedRun = false;
  let simulationStarted = false;
  let simulationAborted = false;

  const configureConversionExit = () => {
    if (!journey) return;
    const finalCta = root.querySelector(".final-cta-section");
    const quoteLink = finalCta?.querySelector(":scope > a.button");
    if (!finalCta || !quoteLink) return;

    const quoteUrl = buildQuoteUrl({
      sector: journey.sector,
      demo: journey.demo,
      service: journey.quoteService,
      goal: journey.goal,
      source: `simulacion_${type}`,
    });
    quoteLink.href = quoteUrl;
    quoteLink.textContent = "Cotizar un flujo como este";
    quoteLink.dataset.simulationQuote = "";
    quoteLink.dataset.quoteCta = "simulation";
    quoteLink.dataset.ctaLocation = "simulation_final";

    const whatsappMessage = [
      `Hola Luenio, vi la simulación ${journey.demo} para ${journey.sector}.`,
      journey.goal,
      "Quiero revisar una solución personalizada para mi negocio.",
    ].join(" ");
    const whatsappLink = document.createElement("a");
    whatsappLink.className = "button simulation-whatsapp-cta";
    whatsappLink.href = `https://wa.me/${brandConfig.whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    whatsappLink.target = "_blank";
    whatsappLink.rel = "noopener";
    whatsappLink.dataset.simulationWhatsapp = "";
    whatsappLink.dataset.source = `simulation_${type}`;
    whatsappLink.textContent = "Hablar por WhatsApp";
    quoteLink.insertAdjacentElement("afterend", whatsappLink);

    const landingLink = root.querySelector(".simulation-nav__brand a:last-child");
    if (landingLink) landingLink.href = journey.landingPath;

    quoteLink.addEventListener("click", () => {
      const properties = {
        sector: journey.sector,
        demo: journey.demo,
        service: journey.quoteService,
        source: `simulacion_${type}`,
        cta_location: "simulation_final",
      };
      trackEvent("simulation_quote_click", properties);
      trackEvent("quote_cta_click", properties);
      trackEvent("demo_context_preserved", properties);
    });
    whatsappLink.addEventListener("click", () => {
      const properties = {
        sector: journey.sector,
        demo: journey.demo,
        service: journey.quoteService,
        source: `simulacion_${type}`,
        cta_location: "simulation_final",
      };
      trackEvent("simulation_whatsapp_click", properties);
      trackEvent("whatsapp_open", properties);
    });
  };

  const bindCaptureAnalytics = () => {
    const form = root.querySelector("#demoCaptureForm");
    if (!form) return;
    let formStarted = false;
    let previousState = form.dataset.state || "";

    form.addEventListener("input", () => {
      if (formStarted) return;
      formStarted = true;
      trackEvent("form_start", {
        source: `industry_demo_${type}`,
        ...analyticsProperties,
      });
    });

    new MutationObserver(() => {
      const nextState = form.dataset.state || "";
      if (!nextState || nextState === previousState) return;
      previousState = nextState;
      if (nextState === "success") {
        trackEvent("generate_lead", {
          source: `industry_demo_${type}`,
          service: journey?.quoteService || "Landing + automatización completa",
          ...analyticsProperties,
        });
      } else if (nextState === "error") {
        trackEvent("form_error", {
          source: `industry_demo_${type}`,
          ...analyticsProperties,
        });
      }
    }).observe(form, { attributes: true, attributeFilter: ["data-state"] });
  };

  runButton.addEventListener("click", () => {
    userInitiatedRun = true;
    trackEvent("simulation_run_click", analyticsProperties);
  });

  const syncState = () => {
    const running = runButton.disabled;
    root.classList.toggle("is-running", running);
    root.dataset.simulationState = running ? "running" : root.dataset.simulationState || "ready";
    // No aria-busy on the root: the status label lives inside it, and a busy
    // ancestor suppresses its live announcements, so the run would pass in total
    // silence for screen reader users. The label itself reports the state.
    if (stateLabel && running) {
      stateLabel.textContent = "Estado: En ejecución";
      stateLabel.dataset.state = "running";
    }

    if (running && !simulationStarted) {
      simulationStarted = true;
      simulationAborted = false;
      trackEvent("simulation_start", {
        ...analyticsProperties,
        trigger: userInitiatedRun ? "manual" : "automatic",
      });
    } else if (!running && simulationStarted) {
      simulationStarted = false;
      userInitiatedRun = false;
      const interrupted = simulationAborted;
      root.dataset.simulationState = interrupted ? "interrupted" : "completed";
      if (stateLabel) {
        stateLabel.textContent = interrupted ? "Estado: Interrumpida" : "Estado: Completada";
        stateLabel.dataset.state = interrupted ? "interrupted" : "completed";
      }
      trackEvent(interrupted ? "simulation_abandon" : "simulation_complete", analyticsProperties);
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && simulationStarted) {
      simulationAborted = true;
    }
  });

  new MutationObserver(syncState).observe(runButton, {
    attributes: true,
    attributeFilter: ["disabled"],
  });

  const resourceState = document.createElement("div");
  resourceState.className = "simulation-resource-state";
  resourceState.hidden = true;
  resourceState.setAttribute("role", "alert");
  const resourceMessage = document.createElement("span");
  resourceMessage.textContent = "No pudimos cargar una imagen de esta experiencia.";
  const resourceRetry = document.createElement("button");
  resourceRetry.type = "button";
  resourceRetry.textContent = "Reintentar";
  resourceState.append(resourceMessage, resourceRetry);
  root.insertBefore(resourceState, root.children[1] || null);

  const failedResources = new Set();
  const backgroundTargets = new Map();
  const syncResourceState = () => {
    resourceState.hidden = failedResources.size === 0;
    if (failedResources.size > 0) {
      resourceMessage.textContent =
        failedResources.size === 1
          ? "No pudimos cargar una imagen de esta experiencia."
          : "No pudimos cargar algunos recursos de esta experiencia.";
    }
  };

  const markResource = (source, failed) => {
    if (failed) {
      failedResources.add(source);
      backgroundTargets.get(source)?.forEach((target) => target.classList.add("is-resource-error"));
    } else {
      failedResources.delete(source);
      backgroundTargets
        .get(source)
        ?.forEach((target) => target.classList.remove("is-resource-error"));
    }
    syncResourceState();
  };

  const resolveResource = (source) => {
    try {
      const url = new URL(source, document.baseURI);
      return /^https?:$/u.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  root.querySelectorAll("img").forEach((image) => {
    const source = resolveResource(image.currentSrc || image.src);
    if (!source) return;
    image.addEventListener("error", () => {
      markResource(source, true);
      image.classList.add("is-resource-error");
    });
    image.addEventListener("load", () => {
      markResource(source, false);
      image.classList.remove("is-resource-error");
    });
    if (image.complete && image.naturalWidth === 0) {
      markResource(source, true);
      image.classList.add("is-resource-error");
    }
  });

  const backgroundUrlPattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gu;
  [...root.querySelectorAll("*"), root].forEach((element) => {
    const backgroundImage = getComputedStyle(element).backgroundImage;
    for (const match of backgroundImage.matchAll(backgroundUrlPattern)) {
      const source = resolveResource(match[1]);
      if (!source) continue;
      const targets = backgroundTargets.get(source) || new Set();
      targets.add(element);
      backgroundTargets.set(source, targets);
      const probe = new Image();
      probe.addEventListener("error", () => markResource(source, true), { once: true });
      probe.addEventListener("load", () => markResource(source, false), { once: true });
      probe.src = source;
    }
  });
  syncResourceState();
  resourceRetry.addEventListener("click", () => {
    resourceRetry.disabled = true;
    resourceRetry.textContent = "Recargando…";
    window.location.reload();
  });
  configureConversionExit();
  bindCaptureAnalytics();
  syncState();
  initAnalytics();
}
