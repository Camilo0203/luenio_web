import { focusAnchorTarget } from "./a11y.js";
import { submitPublicInquiry } from "./api-client.js";
import { brandConfig } from "./brand-config.js";
import { initAnalytics, trackEvent } from "./analytics.js";
import { protectContactForm } from "./contact-security.js";
import { journeyAnalyticsProperties, readJourneyContext } from "./journey-context.js";
import { getPublicJourneyById } from "./public-journeys.js";
import { initThemeControl } from "./theme-control.js";

const body = document.body;
const journeyContext = readJourneyContext();
const quoteDraftStorageKey = "luenio.quote.draft";
const quoteDraftFields = ["name", "business", "service", "message"];
let lastFocusedElement = null;

const whatsappIcon = `
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5.1 22.75L3.38 29l6.4-1.68A12.96 12.96 0 1 0 16.04 3Zm0 23.58c-2.02 0-3.98-.55-5.7-1.6l-.41-.24-3.8 1 1.02-3.7-.27-.43A10.55 10.55 0 1 1 16.04 26.58Zm5.79-7.91c-.32-.16-1.87-.92-2.16-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57a9.57 9.57 0 0 1-1.77-2.2c-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.19.21-.32.32-.53.1-.21.05-.4-.03-.55-.08-.16-.71-1.71-.98-2.35-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.55.08-.84.4-.29.32-1.11 1.08-1.11 2.64 0 1.56 1.13 3.06 1.29 3.27.16.21 2.23 3.4 5.4 4.77.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.87-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.14-.29-.21-.61-.37Z"/>
  </svg>`;

function bindMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-navigation]");
  if (!toggle || !navigation) return;
  const backgroundRegions = [
    document.querySelector("main"),
    document.querySelector("footer"),
  ].filter(Boolean);

  const mobileMenu = window.matchMedia("(max-width: 980px)");
  navigation.id ||= "primary-navigation";
  toggle.setAttribute("aria-controls", navigation.id);

  const setOpen = (open, { returnFocus = false } = {}) => {
    const isOpen = mobileMenu.matches && open;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    navigation.dataset.open = String(isOpen);
    navigation.toggleAttribute("inert", mobileMenu.matches && !isOpen);
    if (mobileMenu.matches) navigation.setAttribute("aria-hidden", String(!isOpen));
    else navigation.removeAttribute("aria-hidden");
    backgroundRegions.forEach((region) => region.toggleAttribute("inert", isOpen));
    body.classList.toggle("mobile-menu-open", isOpen);
    if (returnFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false, { returnFocus: true });
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (navigation.dataset.open !== "true") return;
    if (navigation.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  mobileMenu.addEventListener?.("change", () => setOpen(false));
  window.addEventListener("resize", () => setOpen(false), { passive: true });
  setOpen(false);
}

function bindSmoothNavigation() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const selector = link.getAttribute("href");
      if (!selector || selector === "#") return;
      const target = document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      focusAnchorTarget(target);
      if (!reduceMotion) {
        window.setTimeout(() => {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }, 900);
      }
    });
  });
}

function normalize(value) {
  return String(value || "").trim();
}

function readQuoteDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(quoteDraftStorageKey) || "null");
    if (!draft || typeof draft !== "object") return null;
    return Object.fromEntries(
      quoteDraftFields
        .map((field) => [field, normalize(draft[field]).slice(0, field === "message" ? 600 : 120)])
        .filter(([, value]) => value),
    );
  } catch {
    return null;
  }
}

function updateQuoteDraftNotice(form, hasDraft) {
  const notice = form.querySelector("[data-quote-draft-status]");
  const clearButton = form.querySelector("[data-draft-clear]");
  if (notice) notice.hidden = !hasDraft;
  if (clearButton) clearButton.hidden = !hasDraft;
}

function persistQuoteDraft(form) {
  const draft = Object.fromEntries(
    quoteDraftFields
      .map((field) => [
        field,
        normalize(form.elements[field]?.value).slice(0, field === "message" ? 600 : 120),
      ])
      .filter(([, value]) => value),
  );
  try {
    if (Object.keys(draft).length)
      sessionStorage.setItem(quoteDraftStorageKey, JSON.stringify(draft));
    else sessionStorage.removeItem(quoteDraftStorageKey);
  } catch {
    // A blocked sessionStorage must never interrupt the quote path.
  }
  updateQuoteDraftNotice(form, Object.keys(draft).length > 0);
}

function clearQuoteDraft(form) {
  try {
    sessionStorage.removeItem(quoteDraftStorageKey);
  } catch {
    // Storage cleanup is best effort.
  }
  updateQuoteDraftNotice(form, false);
}

function restoreQuoteDraft(form) {
  const draft = readQuoteDraft();
  if (!draft) {
    updateQuoteDraftNotice(form, false);
    return;
  }
  quoteDraftFields.forEach((field) => {
    const control = form.elements[field];
    if (!control || control.value || (field === "service" && journeyContext.service)) return;
    if (field === "message" && journeyContext.goal) return;
    control.value = draft[field] || "";
  });
  updateQuoteDraftNotice(form, true);
}

function applyQuoteJourneyContext() {
  const form = document.querySelector(".quote-page .lead-form");
  const contextBox = document.querySelector("[data-quote-context]");
  const hasContext =
    journeyContext.sector || journeyContext.demo || journeyContext.service || journeyContext.goal;
  if (!form) return;

  const service = form.elements.service;
  const message = form.elements.message;
  if (
    service &&
    journeyContext.service &&
    [...service.options].some((option) => option.value === journeyContext.service)
  ) {
    service.value = journeyContext.service;
  }
  if (message && journeyContext.goal && !message.value) {
    message.value = journeyContext.goal;
  }

  if (hasContext) {
    form.dataset.source = journeyContext.source
      ? `cotizacion_${journeyContext.source}`
      : "cotizacion_contexto";
  }

  if (hasContext) {
    const origin = journeyContext.demo || journeyContext.sector;
    if (origin) body.dataset.pageContext = `Cotización desde ${origin}`;
  }

  if (contextBox && hasContext) {
    const copy = contextBox.querySelector("[data-quote-context-copy]");
    const sectorLabel = journeyContext.sector
      ? journeyContext.sector.charAt(0).toUpperCase() + journeyContext.sector.slice(1)
      : "";
    if (copy) {
      copy.textContent = journeyContext.demo
        ? `Continuamos desde la demo ${journeyContext.demo}${sectorLabel ? ` · ${sectorLabel}` : ""}.`
        : `Continuamos con tu interés en ${journeyContext.sector}.`;
    }
    contextBox.hidden = false;
  }

  restoreQuoteDraft(form);
  if (hasContext) {
    trackEvent("quote_context_applied", {
      ...journeyAnalyticsProperties(journeyContext),
      cta_location: "contextual_quote",
    });
    if (journeyContext.demo || journeyContext.sector) {
      trackEvent("demo_context_preserved", {
        ...journeyAnalyticsProperties(journeyContext),
        cta_location: "contextual_quote",
      });
    }
  }
}

function setFormState(form, state, message) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-form-status]");
  form.dataset.state = state;
  if (button) {
    button.disabled = state === "loading";
    const label = button.querySelector("span");
    if (label) {
      label.textContent =
        state === "loading" ? "Enviando solicitud..." : "Solicitar cotización gratis";
    }
  }
  if (status) {
    status.setAttribute("role", state === "error" ? "alert" : "status");
    status.hidden = !message;
    status.textContent = message || "";
  }
}

function bindLeadForms() {
  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    const securityPromise = protectContactForm(form);
    const status = form.querySelector("[data-form-status]");
    if (status) {
      status.id ||= `form-status-${Math.random().toString(36).slice(2, 9)}`;
      form.querySelectorAll("input, select, textarea").forEach((control) => {
        control.setAttribute("aria-describedby", status.id);
        control.setAttribute("aria-invalid", "false");
      });
    }
    let started = false;
    form.addEventListener("input", (event) => {
      if (event.target.matches?.("[aria-invalid='true']")) {
        event.target.setAttribute("aria-invalid", "false");
      }
      if (started) return;
      started = true;
      const source = form.dataset.source || "contacto";
      trackEvent("form_start", { source });
      trackEvent("quote_form_start", {
        source,
        service: normalize(form.elements.service?.value),
        cta_location: form.classList.contains("quote-form") ? "quote_form" : "public_form",
        ...journeyAnalyticsProperties(journeyContext),
      });
    });

    if (form.classList.contains("quote-form")) {
      form.addEventListener("input", () => persistQuoteDraft(form));
      form.querySelector("[data-draft-clear]")?.addEventListener("click", () => {
        quoteDraftFields.forEach((field) => {
          const control = form.elements[field];
          if (
            control &&
            !(
              (field === "service" && journeyContext.service) ||
              (field === "message" && journeyContext.goal)
            )
          ) {
            control.value = "";
          }
        });
        clearQuoteDraft(form);
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.state === "loading") return;
      const data = new FormData(form);
      const lead = {
        name: normalize(data.get("name")),
        business: normalize(data.get("business")),
        phone: normalize(data.get("phone")),
        service: normalize(data.get("service")),
        message: normalize(data.get("message")),
        source: form.dataset.source || "contacto",
      };

      form
        .querySelectorAll("[aria-invalid]")
        .forEach((control) => control.setAttribute("aria-invalid", "false"));

      if (
        lead.name.length < 2 ||
        lead.business.length < 2 ||
        lead.phone.replace(/\D/g, "").length < 8 ||
        !lead.service
      ) {
        if (lead.name.length < 2) form.elements.name?.setAttribute("aria-invalid", "true");
        if (lead.business.length < 2) form.elements.business?.setAttribute("aria-invalid", "true");
        if (lead.phone.replace(/\D/g, "").length < 8)
          form.elements.phone?.setAttribute("aria-invalid", "true");
        if (!lead.service) form.elements.service?.setAttribute("aria-invalid", "true");
        setFormState(
          form,
          "error",
          "Completa nombre, negocio, WhatsApp y servicio para continuar.",
        );
        form.querySelector('[aria-invalid="true"]')?.focus();
        trackEvent("form_error", { source: lead.source, reason: "validation" });
        if (form.classList.contains("quote-form")) {
          trackEvent("quote_error", {
            source: lead.source,
            cta_location: "quote_form",
            ...journeyAnalyticsProperties(journeyContext),
          });
        }
        return;
      }

      setFormState(form, "loading", "Enviando tu solicitud...");
      trackEvent("quote_submit", {
        source: lead.source,
        service: lead.service,
        cta_location: form.classList.contains("quote-form") ? "quote_form" : "public_form",
        ...journeyAnalyticsProperties(journeyContext),
      });
      try {
        Object.assign(lead, (await securityPromise).payload());
        await submitPublicInquiry(lead);
        trackEvent("generate_lead", {
          source: lead.source,
          service: lead.service,
          ...journeyAnalyticsProperties(journeyContext),
        });
        trackEvent("quote_success", {
          source: lead.source,
          service: lead.service,
          cta_location: form.classList.contains("quote-form") ? "quote_form" : "public_form",
          ...journeyAnalyticsProperties(journeyContext),
        });
        setFormState(
          form,
          "success",
          "Solicitud recibida. Te contactaremos por WhatsApp para preparar tu diagnóstico gratuito.",
        );
        form.reset();
        if (form.classList.contains("quote-form")) clearQuoteDraft(form);
        (await securityPromise).reset();
        status?.focus();
      } catch (error) {
        console.warn("[Luenio] Contact endpoint unavailable.", error);
        trackEvent("form_error", { source: lead.source, reason: "api" });
        trackEvent("quote_error", {
          source: lead.source,
          cta_location: form.classList.contains("quote-form") ? "quote_form" : "public_form",
          ...journeyAnalyticsProperties(journeyContext),
        });
        setFormState(
          form,
          "error",
          "No pudimos enviar la solicitud. Escríbenos por WhatsApp o inténtalo nuevamente.",
        );
      }
    });
  });
}

function createWhatsappWidget() {
  if (body.dataset.whatsappWidget === "false") return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <aside class="wa-widget" id="whatsapp-contact" aria-hidden="true">
      <button class="wa-widget__backdrop" type="button" data-wa-close aria-label="Cerrar formulario"></button>
      <section class="wa-widget__panel" role="dialog" aria-modal="true" aria-labelledby="wa-title">
        <header class="wa-widget__head">
          <div class="wa-widget__brand">${whatsappIcon}<span>WhatsApp Luenio</span></div>
          <button class="wa-widget__close" type="button" data-wa-close aria-label="Cerrar formulario">&times;</button>
        </header>
        <div class="wa-widget__intro">
          <span>MENSAJE PARA WHATSAPP</span>
          <h2 id="wa-title">Prepara el contexto de tu conversación.</h2>
          <p>Completa 3 datos obligatorios. Toma menos de un minuto.</p>
        </div>
        <form class="wa-widget__form" data-wa-form novalidate>
          <label>Nombre<input name="name" autocomplete="name" required aria-describedby="wa-form-status" /></label>
          <label>Negocio<input name="business" autocomplete="organization" required aria-describedby="wa-form-status" /></label>
          <label>Servicio<select name="service" required aria-describedby="wa-form-status">
            <option value="">Selecciona una opción</option>
            <option>Landing page de conversión</option>
            <option>Automatización de WhatsApp</option>
            <option>Chatbot o asistente IA</option>
            <option>CRM y seguimiento</option>
            <option>Landing + automatización completa</option>
          </select></label>
          <label>Objetivo<textarea name="objective" rows="2" placeholder="Qué quieres mejorar o automatizar"></textarea></label>
          <p class="wa-widget__status" id="wa-form-status" role="alert" hidden></p>
          <button class="wa-widget__submit" type="submit">${whatsappIcon}<span>Continuar en WhatsApp</span></button>
        </form>
      </section>
    </aside>
    <button class="wa-widget__trigger" type="button" data-wa-open aria-controls="whatsapp-contact" aria-expanded="false">${whatsappIcon}<span>Preparar cotización</span></button>`;
  document.body.append(...wrapper.childNodes);

  const modal = document.querySelector("#whatsapp-contact");
  const panel = modal.querySelector(".wa-widget__panel");
  const triggers = document.querySelectorAll("[data-wa-open]");
  const closeButtons = modal.querySelectorAll("[data-wa-close]");
  const form = modal.querySelector("[data-wa-form]");
  const formStatus = form.querySelector("[data-wa-status], .wa-widget__status");
  let activeWhatsappSource = "floating";

  const applyWhatsappJourneyContext = (overrides = {}) => {
    const selectedService = normalize(overrides.service || journeyContext.service);
    const selectedGoal = normalize(overrides.goal || journeyContext.goal);
    form.elements.service.value = "";
    form.elements.objective.value = "";
    if (
      selectedService &&
      [...form.elements.service.options].some((option) => option.value === selectedService)
    ) {
      form.elements.service.value = selectedService;
    }
    if (selectedGoal) {
      form.elements.objective.value = selectedGoal;
    }
  };

  if (journeyContext.demo) {
    const intro = modal.querySelector(".wa-widget__intro p");
    if (intro) {
      intro.textContent = `Continuamos desde la demo ${journeyContext.demo} con el contexto de tu negocio.`;
    }
  }
  applyWhatsappJourneyContext();

  const setOpen = (open, source = "direct") => {
    modal.setAttribute("aria-hidden", String(!open));
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", String(open)));
    body.classList.toggle("modal-open", open);
    if (open) {
      activeWhatsappSource = source;
      lastFocusedElement = document.activeElement;
      trackEvent("whatsapp_open", {
        source,
        cta_location: source,
        ...journeyAnalyticsProperties(journeyContext),
      });
      window.setTimeout(() => form.querySelector("input")?.focus(), 30);
    } else if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const willOpen = modal.getAttribute("aria-hidden") !== "false";
      if (willOpen) {
        const quoteForm = trigger.closest(".quote-form");
        applyWhatsappJourneyContext({
          service: trigger.dataset.service || quoteForm?.elements.service?.value,
          goal: trigger.dataset.goal || quoteForm?.elements.message?.value,
        });
      }
      setOpen(willOpen, trigger.dataset.source || "floating");
    });
  });
  closeButtons.forEach((button) => button.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.getAttribute("aria-hidden") === "false") setOpen(false);
    if (event.key !== "Tab" || modal.getAttribute("aria-hidden") !== "false") return;
    // The submit button is disabled while the inquiry is in flight, so an unfiltered
    // list would park the focus cycle on an inert control.
    const focusable = [...panel.querySelectorAll("button, input, select, textarea")].filter(
      (element) => !element.disabled && element.getAttribute("aria-hidden") !== "true",
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = normalize(data.get("name"));
    const business = normalize(data.get("business"));
    const service = normalize(data.get("service"));
    if (name.length < 2 || business.length < 2 || !service) {
      const invalidControls = [];
      if (name.length < 2) invalidControls.push(form.elements.name);
      if (business.length < 2) invalidControls.push(form.elements.business);
      if (!service) invalidControls.push(form.elements.service);
      invalidControls.forEach((control) => control?.setAttribute("aria-invalid", "true"));
      form.dataset.state = "error";
      if (formStatus) {
        formStatus.hidden = false;
        formStatus.textContent =
          "Completa tu nombre, el nombre de tu negocio y el servicio que te interesa.";
      }
      invalidControls[0]?.focus();
      return;
    }
    const objective = normalize(data.get("objective"));
    const message = [
      `Hola Luenio, soy ${name} de ${business}.`,
      `Me interesa: ${service}.`,
      objective ? `Mi objetivo es: ${objective}.` : "",
      `Llegué desde: ${normalize(body.dataset.pageContext || document.title)}.`,
      "Quiero solicitar una cotización gratuita y personalizada.",
    ]
      .filter(Boolean)
      .join(" ");
    trackEvent("whatsapp_submit", {
      service,
      source: activeWhatsappSource,
      cta_location: activeWhatsappSource,
      ...journeyAnalyticsProperties(journeyContext),
    });
    window.open(
      `https://wa.me/${brandConfig.whatsappPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
    setOpen(false);
    form.reset();
    applyWhatsappJourneyContext();
  });

  form.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    if (form.dataset.state !== "error") return;
    form.dataset.state = "idle";
    if (formStatus) {
      formStatus.hidden = true;
      formStatus.textContent = "";
    }
  });
}

function bindCaseTracking() {
  document.querySelectorAll("[data-demo-case]").forEach((link) => {
    link.addEventListener("click", () => {
      trackEvent("demo_case_click", { case: link.dataset.demoCase });
      trackEvent("featured_demo_open", { case: link.dataset.demoCase });
    });
  });
}

function bindConversionTracking() {
  document.querySelectorAll("[data-quote-cta]").forEach((link) => {
    link.addEventListener("click", () => {
      const linkedJourney = getPublicJourneyById(link.dataset.demoContext || "");
      const clickContext = linkedJourney
        ? {
            sector: linkedJourney.sector,
            demo: linkedJourney.demo,
            service: linkedJourney.quoteService,
            source: link.dataset.quoteCta || "home_demo",
          }
        : journeyContext;
      const properties = {
        ...journeyAnalyticsProperties(clickContext),
        source: link.dataset.quoteCta || clickContext.source || "public",
        cta_location: link.dataset.ctaLocation || link.dataset.quoteCta || "public",
      };
      trackEvent("quote_cta_click", properties);
      if (linkedJourney) trackEvent("demo_context_preserved", properties);
    });
  });
  document.querySelectorAll("[data-all-demos-open]").forEach((link) => {
    link.addEventListener("click", () => trackEvent("all_demos_open"));
  });
}

function bindQuoteFormVisibility() {
  const form = document.querySelector(".quote-page .lead-form");
  if (!form || !("IntersectionObserver" in window)) return;

  const syncWaTriggerA11y = () => {
    const trigger = document.querySelector(".wa-widget__trigger");
    if (!trigger) return;
    const formVisible = body.classList.contains("quote-form-visible");
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    const decorativeHidden = formVisible && !expanded;
    // toggleAttribute would write aria-hidden="", which is not a valid true value:
    // the trigger would stay exposed to screen readers while losing its tab stop.
    if (decorativeHidden) {
      trigger.setAttribute("aria-hidden", "true");
      trigger.setAttribute("tabindex", "-1");
    } else {
      trigger.removeAttribute("aria-hidden");
      trigger.removeAttribute("tabindex");
    }
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      body.classList.toggle("quote-form-visible", entry.isIntersecting);
      syncWaTriggerA11y();
    },
    { rootMargin: "-64px 0px -64px" },
  );
  observer.observe(form);
  syncWaTriggerA11y();
}

function injectOrganizationSchema() {
  if (body.dataset.schema !== "organization") return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    name: brandConfig.name,
    url: brandConfig.domain,
    logo: `${brandConfig.domain}/brand/isotipo.svg`,
    email: brandConfig.email,
    telephone: brandConfig.phoneDisplay,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bogotá D.C.",
      addressCountry: "CO",
    },
    areaServed: "Colombia",
    serviceType: ["Landing pages", "Automatización con inteligencia artificial"],
  });
  document.head.append(script);
}

bindMenu();
initThemeControl();
bindSmoothNavigation();
applyQuoteJourneyContext();
bindLeadForms();
createWhatsappWidget();
bindQuoteFormVisibility();
bindCaseTracking();
bindConversionTracking();
injectOrganizationSchema();
initAnalytics();
