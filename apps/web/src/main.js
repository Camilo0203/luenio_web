import { submitPublicInquiry } from "./api-client.js";
import { protectContactForm } from "./contact-security.js";

const TRACKING_STORAGE_KEY = "luenio.analytics.events";

const funnelState = {
  lastSource: "direct",
  formStarted: false,
  submitting: false,
};

function trackEvent(name, properties = {}) {
  const event = {
    event: name,
    properties,
    timestamp: new Date().toISOString(),
    page: window.location.pathname,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);

  try {
    const storedEvents = JSON.parse(localStorage.getItem(TRACKING_STORAGE_KEY) || "[]");
    storedEvents.push(event);
    localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(storedEvents.slice(-80)));
  } catch (error) {
    console.warn("[Luenio] Analytics storage unavailable.", error);
  }
}

function getSourceFromElement(element) {
  const section = element.closest("section, footer, header");
  if (!section) return "direct";
  if (section.id) return section.id;
  if (section.classList.contains("hero")) return "hero";
  if (section.classList.contains("site-footer")) return "footer";
  return "page";
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildLeadPayload(form, source) {
  const data = new FormData(form);
  return {
    name: normalizeText(data.get("name")),
    business: normalizeText(data.get("business")),
    phone: normalizeText(data.get("phone")),
    service: normalizeText(data.get("service")),
    message: normalizeText(data.get("message")),
    source,
  };
}

function validateLead(lead) {
  const errors = [];
  if (lead.name.length < 2) errors.push("Escribe tu nombre.");
  if (lead.business.length < 2) errors.push("Escribe el nombre del negocio.");
  if (lead.phone.replace(/\D/g, "").length < 8) errors.push("Escribe un WhatsApp válido.");
  if (!lead.service) errors.push("Selecciona el servicio que te interesa.");
  return errors;
}

function setFormState(form, state, message) {
  const button = form.querySelector("button[type='submit']");
  const status = form.querySelector(".form-status");

  form.dataset.state = state;
  if (button) {
    button.disabled = state === "loading";
    button.textContent = state === "loading" ? "Enviando solicitud..." : "Automatizar mi negocio";
  }
  if (status) {
    status.textContent = message || "";
    status.hidden = !message;
  }
}

function bindNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      funnelState.lastSource = getSourceFromElement(link);
      trackEvent("cta_click", {
        label: link.textContent.trim(),
        href: targetId,
        source: funnelState.lastSource,
      });

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindContactForm() {
  const form = document.querySelector("#contactForm");
  if (!form) return;
  const securityPromise = protectContactForm(form);

  form.addEventListener("input", () => {
    if (funnelState.formStarted) return;
    funnelState.formStarted = true;
    trackEvent("form_start", {
      source:
        funnelState.lastSource === "direct" ? getSourceFromElement(form) : funnelState.lastSource,
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (funnelState.submitting) return;

    const source =
      funnelState.lastSource === "direct" ? getSourceFromElement(form) : funnelState.lastSource;
    const lead = {
      ...buildLeadPayload(form, source || "contacto"),
      ...(await securityPromise).payload(),
    };
    const errors = validateLead(lead);

    if (errors.length) {
      setFormState(form, "error", errors[0]);
      trackEvent("form_validation_error", { source: lead.source, errors });
      return;
    }

    funnelState.submitting = true;
    setFormState(form, "loading", "Enviando tu solicitud...");

    try {
      const result = await submitPublicInquiry(lead);

      trackEvent("form_submit", {
        source: lead.source,
        service: lead.service,
        backendStatus: result.ok ? "stored" : "unknown",
      });

      setFormState(
        form,
        "success",
        "Solicitud recibida. Te contactaremos por WhatsApp para revisar tu proceso y recomendar la automatización adecuada.",
      );
      form.reset();
      (await securityPromise).reset();
    } catch (error) {
      console.warn("[Luenio] Contact endpoint unavailable.", error);
      trackEvent("form_submit_error", {
        source: lead.source,
        service: lead.service,
        reason: "contact_api_unavailable",
      });
      setFormState(
        form,
        "error",
        "No pudimos enviar la solicitud. Inténtalo de nuevo en unos minutos.",
      );
    } finally {
      funnelState.submitting = false;
    }
  });
}

function bindBrandLogo() {
  document.querySelectorAll(".brand-logo").forEach((logo) => {
    const brand = logo.closest(".brand");
    if (!brand) return;

    const showLogo = () => {
      brand.classList.add("has-logo");
      brand.classList.remove("logo-error");
    };
    const showFallback = () => {
      brand.classList.remove("has-logo");
      brand.classList.add("logo-error");
    };

    logo.addEventListener("load", showLogo, { once: true });
    logo.addEventListener("error", showFallback);

    if (logo.complete && logo.naturalWidth > 0) showLogo();
  });
}

function bindActiveNavLinks() {
  const navLinks = [...document.querySelectorAll(".topnav a[href^='#']")];
  const sectionMap = new Map();
  const navbar = document.querySelector(".topbar");

  navLinks.forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (section) sectionMap.set(section, link);
  });

  if (!sectionMap.size) return;

  const setActiveLink = (activeLink) => {
    navLinks.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };

  const syncActiveLink = () => {
    const offset = (navbar?.offsetHeight || 0) + 24;
    const sections = [...sectionMap.keys()];
    let currentSection = sections[0];

    sectionMap.forEach((_, section) => {
      if (section.getBoundingClientRect().top <= offset) currentSection = section;
    });

    setActiveLink(sectionMap.get(currentSection));
  };

  syncActiveLink();
  window.addEventListener("scroll", syncActiveLink, { passive: true });
}

bindNavigation();
bindBrandLogo();
bindActiveNavLinks();
bindContactForm();
