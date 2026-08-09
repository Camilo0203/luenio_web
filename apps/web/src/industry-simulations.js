import { initAnalytics, trackEvent } from "./analytics.js";
import { brandConfig } from "./brand-config.js";
import { buildQuoteUrl } from "./journey-context.js";

const root = document.querySelector(".demo-page[data-demo-type]");
const runButton = root?.querySelector('button[id^="run"]');

if (root && runButton) {
  const simulationJourneys = {
    agencies: {
      sector: "agencia",
      demo: "Impulso Digital",
      landingPath: "/agencias",
      goal: "Quiero captar y calificar oportunidades para los clientes de mi agencia",
    },
    ecommerce: {
      sector: "tienda online",
      demo: "NovaStore",
      landingPath: "/tiendas-online",
      goal: "Quiero recuperar conversaciones de compra y darles seguimiento",
    },
    gym: {
      sector: "gimnasio",
      demo: "Titan Fitness Club",
      landingPath: "/gimnasios",
      goal: "Quiero convertir consultas por precio en visitas y membresías",
    },
    "real-estate": {
      sector: "inmobiliaria",
      demo: "Hogar Prime",
      landingPath: "/inmobiliarias",
      goal: "Quiero calificar compradores y organizar el seguimiento inmobiliario",
    },
    restaurants: {
      sector: "restaurante",
      demo: "Sabor & Fuego",
      landingPath: "/restaurantes",
      goal: "Quiero organizar reservas, pedidos y seguimiento desde WhatsApp",
    },
    veterinary: {
      sector: "veterinaria",
      demo: "Huella Veterinaria",
      landingPath: "/veterinarias",
      goal: "Quiero convertir consultas de mascotas en citas atendidas",
    },
    aesthetics: {
      sector: "estética",
      demo: "Aura Estética",
      landingPath: "/esteticas",
      goal: "Quiero convertir consultas de tratamientos en valoraciones",
    },
  };
  const type = root.dataset.demoType;
  const journey = simulationJourneys[type];
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
      service: "Landing + automatización completa",
      goal: journey.goal,
      source: `simulacion_${type}`,
    });
    quoteLink.href = quoteUrl;
    quoteLink.textContent = "Solicitar cotización";
    quoteLink.dataset.simulationQuote = "";

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
    whatsappLink.textContent = "Hablar por WhatsApp";
    quoteLink.insertAdjacentElement("afterend", whatsappLink);

    const landingLink = root.querySelector(".simulation-nav__brand a:last-child");
    if (landingLink) landingLink.href = journey.landingPath;

    quoteLink.addEventListener("click", () => {
      trackEvent("simulation_quote_click", analyticsProperties);
    });
    whatsappLink.addEventListener("click", () => {
      trackEvent("simulation_whatsapp_click", analyticsProperties);
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
          service: "Landing + automatización completa",
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
    root.dataset.simulationState = running ? "running" : "ready";
    root.setAttribute("aria-busy", String(running));

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
      trackEvent(
        simulationAborted ? "simulation_abandon" : "simulation_complete",
        analyticsProperties,
      );
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
  configureConversionExit();
  bindCaptureAnalytics();
  syncState();
  initAnalytics();
}
