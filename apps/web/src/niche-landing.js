import { initAnalytics, trackEvent } from "./analytics.js";
import { buildQuoteUrl } from "./journey-context.js";
import { initThemeControl } from "./theme-control.js";

const body = document.body;
const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const fontStylesheet = document.querySelector("[data-font-stylesheet]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const navigation = document.querySelector("[data-navigation]");
const demoForms = document.querySelectorAll("[data-demo-form]");
const defaultWhatsappPhone = ["57", "319", "320", "3702"].join("");
let lastFocusedElement = null;

if (fontStylesheet?.media === "print") {
  fontStylesheet.media = "all";
}

initThemeControl();

const whatsappIcon = `
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5.1 22.75L3.38 29l6.4-1.68A12.96 12.96 0 1 0 16.04 3Zm0 23.58c-2.02 0-3.98-.55-5.7-1.6l-.41-.24-3.8 1 1.02-3.7-.27-.43A10.55 10.55 0 1 1 16.04 26.58Zm5.79-7.91c-.32-.16-1.87-.92-2.16-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57a9.57 9.57 0 0 1-1.77-2.2c-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.19.21-.32.32-.53.1-.21.05-.4-.03-.55-.08-.16-.71-1.71-.98-2.35-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.55.08-.84.4-.29.32-1.11 1.08-1.11 2.64 0 1.56 1.13 3.06 1.29 3.27.16.21 2.23 3.4 5.4 4.77.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.87-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.14-.29-.21-.61-.37Z"/>
  </svg>`;

function closeMenu() {
  if (!menuToggle || !navigation) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menú");
  navigation.dataset.open = "false";
}

if (menuToggle && navigation) {
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    menuToggle.setAttribute("aria-label", open ? "Abrir menú" : "Cerrar menú");
    navigation.dataset.open = String(!open);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const selector = link.getAttribute("href");
    if (!selector || selector === "#") return;
    const target = document.querySelector(selector);
    if (!target) return;
    event.preventDefault();
    closeMenu();
    trackEvent("demo_cta_click", {
      niche: body.dataset.demoType,
      label: link.textContent.trim(),
      target: selector,
    });
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
});

demoForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-demo-status]");
    if (status) {
      status.hidden = false;
      status.textContent =
        form.dataset.demoSuccess ||
        "Demostración completada. No se enviaron datos; en el proyecto real esta acción se conectaría al sistema del negocio.";
    }
    trackEvent("demo_cta_click", {
      niche: body.dataset.demoType,
      label: "demo_form_submit",
    });
  });
});

function createWhatsappWidget() {
  const demoName = body.dataset.demoName || "esta landing";
  const demoType = body.dataset.demoType || "negocio";
  const goal = body.dataset.demoGoal || `Quiero una landing para mi ${demoType}`;
  const quoteSource = `demo_${demoType}`;
  const quoteUrl = buildQuoteUrl({
    sector: demoType,
    demo: demoName,
    service: "Landing page de conversión",
    goal,
    source: quoteSource,
  });

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <aside class="luenio-wa" id="luenio-whatsapp" aria-hidden="true">
      <button class="luenio-wa__backdrop" type="button" data-luenio-close aria-label="Cerrar formulario"></button>
      <section class="luenio-wa__panel" role="dialog" aria-modal="true" aria-labelledby="luenio-wa-title">
        <header class="luenio-wa__head">
          <div class="luenio-wa__brand">${whatsappIcon}<span>WhatsApp Luenio</span></div>
          <button class="luenio-wa__close" type="button" data-luenio-close aria-label="Cerrar formulario">&times;</button>
        </header>
        <div class="luenio-wa__intro">
          <p>LANDINGS A MEDIDA</p>
          <h2 id="luenio-wa-title">Quiero una página así.</h2>
          <span>Cuéntanos sobre tu negocio y prepararemos el mensaje para Luenio.</span>
        </div>
        <form class="luenio-wa__form" id="luenio-contact-form" novalidate>
          <div class="luenio-wa__row">
            <label><span>Nombre</span><input type="text" name="name" autocomplete="name" required aria-describedby="luenio-form-status" /></label>
            <label><span>Negocio</span><input type="text" name="business" autocomplete="organization" required aria-describedby="luenio-form-status" /></label>
          </div>
          <label><span>Tu WhatsApp</span><input type="tel" name="phone" autocomplete="tel" inputmode="tel" required aria-describedby="luenio-form-status" /></label>
          <label><span>¿Qué necesitas?</span><select name="goal" aria-describedby="luenio-form-status"><option>${goal}</option><option>Quiero una landing para otro negocio</option><option>Quiero página + automatización</option></select></label>
          <label><span>Objetivo</span><textarea name="message" rows="2" placeholder="Cuéntanos qué quieres lograr"></textarea></label>
          <p class="luenio-wa__status" id="luenio-form-status" role="alert" hidden></p>
          <button class="luenio-wa__submit" type="submit">${whatsappIcon}<span>Enviar a WhatsApp</span></button>
          <a class="luenio-wa__quote-link" href="${quoteUrl}" data-quote-link>Prefiero completar el formulario</a>
        </form>
      </section>
    </aside>
    <button class="luenio-wa__trigger" type="button" data-luenio-open aria-label="Quiero una página así" aria-controls="luenio-whatsapp" aria-expanded="false">${whatsappIcon}<span>Quiero una página así</span></button>`;
  document.body.append(...wrapper.childNodes);

  const modal = document.querySelector("#luenio-whatsapp");
  const panel = modal?.querySelector(".luenio-wa__panel");
  const form = document.querySelector("#luenio-contact-form");
  const formStatus = form?.querySelector(".luenio-wa__status");
  const triggers = document.querySelectorAll("[data-luenio-open]");
  const floatingTrigger = document.querySelector(".luenio-wa__trigger");
  const closeButtons = document.querySelectorAll("[data-luenio-close]");
  const hasFixedWhatsappPosition = body.dataset.whatsappPosition === "fixed";

  window.addEventListener("luenio:demo-goal-change", (event) => {
    const nextGoal = String(event.detail?.goal || "").trim();
    if (!nextGoal) return;
    body.dataset.demoGoal = nextGoal;
    const goalSelect = form?.elements?.goal;
    if (goalSelect?.options?.[0]) {
      goalSelect.options[0].textContent = nextGoal;
      goalSelect.options[0].value = nextGoal;
      goalSelect.selectedIndex = 0;
    }
    form?.querySelectorAll("[data-quote-link]").forEach((link) => {
      link.href = buildQuoteUrl({
        sector: demoType,
        demo: demoName,
        service: "Landing page de conversión",
        goal: nextGoal,
        source: quoteSource,
      });
    });
  });

  let collisionFrame = 0;
  const overlaps = (first, second) => {
    const width = Math.max(
      0,
      Math.min(first.right, second.right) - Math.max(first.left, second.left),
    );
    const height = Math.max(
      0,
      Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
    );
    return width * height > 1;
  };

  const setTriggerCollisionHidden = (hidden) => {
    if (!floatingTrigger) return;
    floatingTrigger.classList.toggle("is-collision-hidden", hidden);
    if (hidden) {
      floatingTrigger.setAttribute("aria-hidden", "true");
      floatingTrigger.setAttribute("tabindex", "-1");
    } else {
      floatingTrigger.removeAttribute("aria-hidden");
      floatingTrigger.removeAttribute("tabindex");
    }
  };

  const updateTriggerPosition = () => {
    collisionFrame = 0;
    if (!floatingTrigger) return;
    if (hasFixedWhatsappPosition) {
      floatingTrigger.style.setProperty("--luenio-trigger-lift", "0px");
      setTriggerCollisionHidden(false);
      return;
    }
    if (modal?.getAttribute("aria-hidden") === "false") return;
    setTriggerCollisionHidden(false);

    const collisionTargets = [
      ...document.querySelectorAll(
        "a, button, input, select, textarea, [data-luenio-collision-zone]",
      ),
    ].filter((target) => {
      if (target === floatingTrigger || target.closest(".luenio-wa")) return false;
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    for (const lift of [0, 68, 136, 204]) {
      floatingTrigger.style.setProperty("--luenio-trigger-lift", `${lift}px`);
      const triggerRect = floatingTrigger.getBoundingClientRect();
      if (
        !collisionTargets.some((target) => overlaps(triggerRect, target.getBoundingClientRect()))
      ) {
        return;
      }
    }
    floatingTrigger.style.setProperty("--luenio-trigger-lift", "0px");
    setTriggerCollisionHidden(false);
  };

  const queueTriggerPosition = () => {
    if (collisionFrame) return;
    collisionFrame = window.requestAnimationFrame(updateTriggerPosition);
  };

  const setOpen = (open) => {
    modal?.setAttribute("aria-hidden", String(!open));
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", String(open)));
    body.classList.toggle("luenio-modal-open", open);
    if (open) {
      lastFocusedElement = document.activeElement;
      trackEvent("luenio_widget_open", { niche: demoType, demo: demoName });
      window.setTimeout(() => form?.querySelector("input")?.focus(), 20);
    } else if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    queueTriggerPosition();
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      setOpen(modal?.getAttribute("aria-hidden") !== "false");
    });
  });
  closeButtons.forEach((button) => button.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.getAttribute("aria-hidden") === "false") {
      setOpen(false);
    }
    if (event.key !== "Tab" || modal?.getAttribute("aria-hidden") !== "false" || !panel) return;
    const focusable = [
      ...panel.querySelectorAll("button, input, select, textarea, a[href]"),
    ].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
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

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const business = String(data.get("business") || "").trim();
    const visitorPhone = String(data.get("phone") || "").trim();
    const invalidControls = [];

    form
      .querySelectorAll("[aria-invalid]")
      .forEach((control) => control.removeAttribute("aria-invalid"));
    if (name.length < 2) invalidControls.push(form.elements.name);
    if (business.length < 2) invalidControls.push(form.elements.business);
    if (visitorPhone.replace(/\D/g, "").length < 8) invalidControls.push(form.elements.phone);

    if (invalidControls.length) {
      invalidControls.forEach((control) => control?.setAttribute("aria-invalid", "true"));
      if (formStatus) {
        formStatus.hidden = false;
        formStatus.textContent =
          "Completa tu nombre, negocio y un número de WhatsApp válido para continuar.";
      }
      invalidControls[0]?.focus();
      trackEvent("form_error", {
        source: quoteSource,
        niche: demoType,
        reason: "validation",
      });
      return;
    }

    const phone = body.dataset.whatsappPhone || defaultWhatsappPhone;
    const message = [
      `Hola Luenio, vi la demo ${demoName} para ${demoType} y quiero una página así.`,
      `Mi nombre es ${name}.`,
      `Mi negocio es ${business}.`,
      `Mi WhatsApp es ${visitorPhone}.`,
      `Necesito: ${String(data.get("goal") || goal).trim()}.`,
      String(data.get("message") || "").trim()
        ? `Objetivo: ${String(data.get("message")).trim()}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    trackEvent("whatsapp_submit", { niche: demoType, demo: demoName });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    setOpen(false);
  });

  form?.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    if (formStatus) {
      formStatus.hidden = true;
      formStatus.textContent = "";
    }
  });
  form?.querySelector("[data-quote-link]")?.addEventListener("click", () => {
    trackEvent("quote_form_open", {
      niche: demoType,
      demo: demoName,
      source: quoteSource,
    });
  });

  if (!hasFixedWhatsappPosition) {
    window.addEventListener("scroll", queueTriggerPosition, { passive: true });
    window.addEventListener("resize", queueTriggerPosition);
    const layoutObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(queueTriggerPosition) : null;
    document.querySelectorAll("main, [data-luenio-collision-zone]").forEach((target) => {
      layoutObserver?.observe(target);
    });
    document.fonts?.ready?.then(queueTriggerPosition);
  }
  queueTriggerPosition();
}

createWhatsappWidget();
initAnalytics();
