import { trackEvent } from "./analytics.js";
import { buildQuoteUrl } from "./journey-context.js";
import { getPublicJourneyById } from "./public-journeys.js";

document.documentElement.classList.add("js");

const fontStylesheet = document.querySelector("[data-font-stylesheet]");
if (fontStylesheet) {
  const activateFontStylesheet = () => {
    fontStylesheet.media = "all";
  };

  if (fontStylesheet.sheet) activateFontStylesheet();
  else fontStylesheet.addEventListener("load", activateFontStylesheet, { once: true });
}

const root = document.querySelector(".home-clarity");

if (root) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("[data-home-header]");
  const stage = document.querySelector("[data-hero-stage]");
  const browserFrame = stage?.querySelector(".hc-browser");
  const demoButtons = [...document.querySelectorAll("[data-demo-target]")];
  const demoShots = [...document.querySelectorAll("[data-demo-shot]")];

  // Solo la primera imagen trae src; las otras se piden al hacer clic en su
  // pestana, y esa espera (red + decode del AVIF) se sentia como que el
  // selector no respondia, sobre todo en celular. Se precargan en cuanto el
  // navegador tiene un respiro: loadDemoShot ya evita relanzar la carga si
  // el clic real llega antes de que esto corra.
  const prefetchDemoShots = () => demoShots.forEach((shot) => loadDemoShot(shot));
  if ("requestIdleCallback" in globalThis) {
    globalThis.requestIdleCallback(prefetchDemoShots, { timeout: 4000 });
  } else {
    setTimeout(prefetchDemoShots, 1500);
  }
  const activeDemoLink = document.querySelector("[data-active-demo-link]");
  const mobileDemoLink = document.querySelector("[data-mobile-demo-link]");
  const demoStatus = document.querySelector("[data-demo-status]");
  const activeDemoLabel = document.querySelector("[data-demo-active-label]");
  const demoQuoteLink = document.querySelector("[data-demo-quote-link]");
  const demoError = document.querySelector("[data-demo-error]");
  let demoRequest = 0;
  let activeDemoIndex = 0;

  const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  function loadDemoShot(shot) {
    if (!shot || shot.currentSrc || shot.src) return shot?.decode?.().catch(() => {});

    // Phones get the 640px cut when the markup offers one: these shots are swapped
    // in by script, so they cannot use <picture> media queries like the first one.
    const wantsMobile =
      shot.dataset.mobileSrc && globalThis.matchMedia?.("(max-width: 767px)").matches;
    const source = wantsMobile ? shot.dataset.mobileSrc : shot.dataset.src;
    if (!source) return Promise.resolve();

    shot.src = source;
    return shot.decode?.().catch(() => {}) || Promise.resolve();
  }

  demoShots.forEach((shot) => {
    shot.addEventListener("error", () => {
      const fallback = shot.dataset.fallbackSrc;
      if (fallback && shot.dataset.fallbackAttempted !== "true") {
        shot.dataset.fallbackAttempted = "true";
        shot.src = fallback;
        return;
      }
      if (demoError) {
        demoError.hidden = false;
        demoError.textContent =
          "No pudimos cargar esta vista previa. Puedes abrir la experiencia completa.";
      }
      browserFrame?.removeAttribute("aria-busy");
    });
  });

  async function showDemo(index) {
    const next = (index + demoButtons.length) % demoButtons.length;
    const button = demoButtons[next];
    const target = button?.dataset.demoTarget;
    if (!button || !target) return;
    const shot = demoShots.find((item) => item.dataset.demoShot === target);
    const request = ++demoRequest;
    browserFrame?.setAttribute(
      "data-motion-direction",
      next >= activeDemoIndex ? "forward" : "backward",
    );

    demoButtons.forEach((item, itemIndex) => {
      const selected = itemIndex === next;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    const demoLabel = button.textContent.trim();
    const demoHref = button.dataset.demoHref || "#demos";
    const demoCase = button.dataset.demoCaseId || target;
    const journey = getPublicJourneyById(button.dataset.demoJourneyId || target);

    if (activeDemoLink) {
      activeDemoLink.href = demoHref;
      activeDemoLink.dataset.demoCase = demoCase;
      activeDemoLink.setAttribute("aria-label", `Abrir demo ficticia de ${demoLabel}`);
    }
    if (mobileDemoLink) {
      mobileDemoLink.href = demoHref;
      mobileDemoLink.dataset.demoCase = demoCase;
      // The accessible name must start with the visible text, or voice control
      // cannot address this link by what it says (WCAG 2.5.3).
      mobileDemoLink.setAttribute(
        "aria-label",
        `Abrir demo de ${demoLabel}, demostración ficticia`,
      );
      // Address the label text node directly. firstChild happens to be whitespace
      // today, but if the markup is ever collapsed it becomes the icon, and writing
      // to it would silently replace the SVG instead of the label.
      const labelNode =
        [...mobileDemoLink.childNodes].find((node) => node.nodeType === Node.TEXT_NODE) ??
        mobileDemoLink.insertBefore(document.createTextNode(""), mobileDemoLink.firstChild);
      labelNode.textContent = `Abrir demo de ${demoLabel} `;
    }
    if (demoStatus) {
      demoStatus.textContent = `Mostrando demo ficticia de ${demoLabel}`;
    }
    if (activeDemoLabel) activeDemoLabel.textContent = demoLabel;
    if (demoQuoteLink && journey) {
      demoQuoteLink.href = buildQuoteUrl({
        sector: journey.sector,
        demo: journey.demo,
        service: journey.quoteService,
        goal: journey.goal,
        source: "home_demo",
      });
      demoQuoteLink.dataset.demoContext = journey.id;
    }
    if (demoError) demoError.hidden = true;

    browserFrame?.setAttribute("aria-busy", "true");
    await loadDemoShot(shot);
    if (request !== demoRequest) return;
    demoShots.forEach((shot) => {
      const selected = shot.dataset.demoShot === target;
      shot.classList.toggle("is-active", selected);
      shot.setAttribute("aria-hidden", String(!selected));
    });
    browserFrame?.removeAttribute("aria-busy");
    activeDemoIndex = next;
  }

  demoButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      void showDemo(index);
      trackEvent("demo_selector_change", {
        case: button.dataset.demoCaseId || button.dataset.demoTarget,
        sector: button.dataset.demoTarget,
        cta_location: "home_demo_switcher",
      });
    });
    const preload = () => {
      const shot = demoShots.find((item) => item.dataset.demoShot === button.dataset.demoTarget);
      void loadDemoShot(shot);
    };
    button.addEventListener("pointerenter", preload, { once: true });
    button.addEventListener("focus", preload, { once: true });
  });
  void showDemo(0);

  if (!reduceMotion && stage && browserFrame && window.matchMedia("(pointer: fine)").matches) {
    stage.addEventListener("pointermove", (event) => {
      const bounds = stage.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      stage.style.setProperty("--hc-aura-x", `${(x * -18).toFixed(2)}px`);
      stage.style.setProperty("--hc-aura-y", `${(y * -12).toFixed(2)}px`);
      stage.style.setProperty("--hc-heading-x", `${(x * 6).toFixed(2)}px`);
      stage.style.setProperty("--hc-heading-y", `${(y * 4).toFixed(2)}px`);
      browserFrame.style.transform = `rotateX(${(-y * 1.6).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg) translateY(-2px)`;
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.removeProperty("--hc-aura-x");
      stage.style.removeProperty("--hc-aura-y");
      stage.style.removeProperty("--hc-heading-x");
      stage.style.removeProperty("--hc-heading-y");
      browserFrame.style.transform = "";
    });
  }

  const observed = document.querySelectorAll("[data-reveal], [data-flow-track]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    observed.forEach((element) => revealObserver.observe(element));
  } else {
    observed.forEach((element) => element.classList.add("is-visible"));
  }

  const motionScenes = [...document.querySelectorAll("[data-motion-scene]")];
  if ("IntersectionObserver" in window && !reduceMotion) {
    const sceneObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle(
            "is-motion-active",
            entry.isIntersecting && !document.hidden,
          );
        });
      },
      { threshold: 0.08 },
    );
    motionScenes.forEach((scene) => sceneObserver.observe(scene));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        motionScenes.forEach((scene) => scene.classList.remove("is-motion-active"));
        return;
      }
      motionScenes.forEach((scene) => {
        const bounds = scene.getBoundingClientRect();
        scene.classList.toggle(
          "is-motion-active",
          bounds.bottom > 0 && bounds.top < window.innerHeight,
        );
      });
    });
  }

  document.querySelectorAll(".hc-accordion details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll(".hc-accordion details[open]").forEach((item) => {
        if (item !== details) item.open = false;
      });
    });
  });

  const chatDemo = document.querySelector("[data-chat-demo]");
  if (chatDemo) {
    const chatTabs = [...chatDemo.querySelectorAll("[data-chat-tab]")];
    const chatPanels = [...chatDemo.querySelectorAll("[data-chat-panel]")];
    const chatFlowTitle = chatDemo.querySelector("[data-chat-flow-title]");
    const chatFlowCopy = chatDemo.querySelector("[data-chat-flow-copy]");
    const chatSteps = [...chatDemo.querySelectorAll("[data-chat-step]")];
    const chatFlows = {
      whatsapp: {
        title: "Del mensaje al seguimiento",
        copy: "La conversación no se queda aislada: conserva la intención y prepara el siguiente paso.",
        currentStep: "follow-up",
      },
      instagram: {
        title: "De una pregunta a una oportunidad clara",
        copy: "El flujo convierte una consulta breve en contexto útil para conversar con más precisión.",
        currentStep: "understand",
      },
      facebook: {
        title: "De la campaña a una acción concreta",
        copy: "Cada mensaje puede llegar ordenado para que el equipo sepa cómo continuar.",
        currentStep: "follow-up",
      },
    };

    const setChatChannel = (channel, moveFocus = false) => {
      const activeChannel = chatFlows[channel] ? channel : "whatsapp";
      const flow = chatFlows[activeChannel];
      chatDemo.dataset.chatChannel = activeChannel;

      chatTabs.forEach((tab) => {
        const selected = tab.dataset.chatTab === activeChannel;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && moveFocus) tab.focus();
      });

      chatPanels.forEach((panel) => {
        const selected = panel.dataset.chatPanel === activeChannel;
        panel.hidden = !selected;
        panel.classList.toggle("is-active", selected);
      });

      if (chatFlowTitle) chatFlowTitle.textContent = flow.title;
      if (chatFlowCopy) chatFlowCopy.textContent = flow.copy;
      chatSteps.forEach((step) => {
        const stepName = step.dataset.chatStep;
        const isCurrent = stepName === flow.currentStep;
        const isComplete =
          stepName === "entry" || (activeChannel !== "instagram" && stepName === "understand");
        step.classList.toggle("is-current", isCurrent);
        step.classList.toggle("is-complete", !isCurrent && isComplete);
      });
    };

    chatTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => setChatChannel(tab.dataset.chatTab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown")
          nextIndex = (index + 1) % chatTabs.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp")
          nextIndex = (index - 1 + chatTabs.length) % chatTabs.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = chatTabs.length - 1;
        setChatChannel(chatTabs[nextIndex].dataset.chatTab, true);
      });
    });

    // --- La conversación se representa a sí misma -------------------------
    //
    // Antes de cada mensaje aparecen los puntos de "escribiendo"; al enviarse,
    // la burbuja entra completa —caja y texto a la vez— desde abajo, como en un
    // chat real. Los mensajes que aún no se han enviado no ocupan espacio, así
    // que se apilan hacia arriba sobre el borde inferior del panel.
    //
    // El panel tiene alto propio (520px) y la zona de mensajes es su fila
    // flexible, de modo que mostrarlos de uno en uno no mueve nada fuera: el
    // presupuesto de CLS no se toca.
    //
    // El estado base es "todo visible": la clase de secuencia la pone este
    // script, así que sin JavaScript o con `prefers-reduced-motion` la
    // conversación se lee entera y estática.
    const COMPOSE_MIN_MS = 620;
    const COMPOSE_PER_CHAR_MS = 13;
    const COMPOSE_MAX_MS = 1500;
    const AFTER_SEND_MS = 420;
    const HOLD_MS = 4200;
    let sequenceTimers = [];

    const clearSequence = () => {
      sequenceTimers.forEach((timer) => clearTimeout(timer));
      sequenceTimers = [];
    };

    const composeTime = (message) =>
      Math.min(
        COMPOSE_MAX_MS,
        COMPOSE_MIN_MS + message.textContent.trim().length * COMPOSE_PER_CHAR_MS,
      );

    const resetPanel = (panel) => {
      panel
        .querySelectorAll(".hc-chat-message.is-sent, .hc-chat-suggestion.is-sent")
        .forEach((node) => node.classList.remove("is-sent"));
      const dots = panel.querySelector(".hc-chat-typing");
      if (dots) {
        dots.hidden = true;
        dots.classList.remove("is-outgoing");
      }
    };

    const playSequence = (panel) => {
      clearSequence();
      const messages = [...panel.querySelectorAll(".hc-chat-message")];
      const dots = panel.querySelector(".hc-chat-typing");
      const suggestion = panel.querySelector(".hc-chat-suggestion");
      if (!messages.length) return;

      panel.dataset.sequence = "on";
      resetPanel(panel);

      let at = 320;
      messages.forEach((message) => {
        const wait = composeTime(message);
        const outgoing = message.classList.contains("hc-chat-message--outgoing");
        sequenceTimers.push(
          setTimeout(() => {
            if (!dots) return;
            dots.hidden = false;
            dots.classList.toggle("is-outgoing", outgoing);
          }, at),
        );
        at += wait;
        sequenceTimers.push(
          setTimeout(() => {
            if (dots) dots.hidden = true;
            message.classList.add("is-sent");
          }, at),
        );
        at += AFTER_SEND_MS;
      });

      if (suggestion) {
        sequenceTimers.push(setTimeout(() => suggestion.classList.add("is-sent"), at));
      }
      sequenceTimers.push(setTimeout(() => playSequence(panel), at + HOLD_MS));
    };

    const stopSequence = () => {
      clearSequence();
      chatPanels.forEach((panel) => {
        delete panel.dataset.sequence;
        resetPanel(panel);
      });
    };

    const activePanel = () =>
      chatPanels.find((panel) => panel.dataset.chatPanel === chatDemo.dataset.chatChannel);

    const syncSequence = () => {
      if (reduceMotion) return;
      const panel = activePanel();
      if (!chatDemo.classList.contains("is-motion-active") || document.hidden || !panel) {
        stopSequence();
        return;
      }
      chatPanels.forEach((other) => {
        if (other === panel) return;
        delete other.dataset.sequence;
        resetPanel(other);
      });
      playSequence(panel);
    };

    if (!reduceMotion && "IntersectionObserver" in window) {
      new MutationObserver(syncSequence).observe(chatDemo, {
        attributes: true,
        attributeFilter: ["class", "data-chat-channel"],
      });
      document.addEventListener("visibilitychange", syncSequence);
    }

    setChatChannel(chatDemo.dataset.chatChannel || "whatsapp");
  }

  const accordionDetails = [...document.querySelectorAll(".hc-accordion details")];
  if (accordionDetails.length && !reduceMotion && typeof Element.prototype.animate === "function") {
    const ACCORDION_DURATION = 320;
    const ACCORDION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

    accordionDetails.forEach((details) => {
      const summary = details.querySelector("summary");
      if (!summary) return;
      let animation = null;

      const runAnimation = (keyframes, onDone) => {
        details.style.overflow = "hidden";
        animation?.cancel();
        animation = details.animate(keyframes, {
          duration: ACCORDION_DURATION,
          easing: ACCORDION_EASING,
        });
        animation.onfinish = () => {
          animation = null;
          details.style.overflow = "";
          details.style.height = "";
          onDone?.();
        };
      };

      summary.addEventListener("click", (event) => {
        event.preventDefault();
        const startHeight = `${details.offsetHeight}px`;
        if (details.open) {
          runAnimation([{ height: startHeight }, { height: `${summary.offsetHeight}px` }], () => {
            details.open = false;
          });
        } else {
          details.open = true;
          const endHeight = `${details.offsetHeight}px`;
          runAnimation([{ height: startHeight }, { height: endHeight }]);
        }
      });
    });
  }

  root.classList.add("motion-ready");
}
