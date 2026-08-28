import { trackEvent } from "./analytics.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const resultMotion = {
  agency: [
    { clipPath: "inset(0 0 100% 0)", filter: "brightness(1.18)" },
    { clipPath: "inset(0 0 0 0)", filter: "brightness(1)" },
  ],
  commerce: [
    { filter: "saturate(0.72) brightness(1.1)", transform: "scale(0.975)" },
    { filter: "saturate(1) brightness(1)", transform: "scale(1)" },
  ],
  property: [
    { clipPath: "inset(0 0 0 14%)", transform: "translateX(10px)" },
    { clipPath: "inset(0 0 0 0)", transform: "translateX(0)" },
  ],
  restaurant: [
    { clipPath: "inset(0 0 24% 0)", transform: "translateY(-5px) rotate(0.25deg)" },
    { clipPath: "inset(0 0 0 0)", transform: "translateY(0) rotate(0)" },
  ],
};

const acknowledgeResult = (root, target, motion) => {
  if (!target || reduceMotion) return;
  if (!root.dataset.motionReady) {
    root.dataset.motionReady = "true";
    return;
  }
  target.getAnimations().forEach((animation) => animation.cancel());
  target.animate(resultMotion[motion], {
    duration: 300,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  });
};

const setPressed = (buttons, activeButton) => {
  buttons.forEach((button) => {
    const selected = button === activeButton;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
};

const bindChoiceGroups = (root, onChange) => {
  const groups = [...root.querySelectorAll("[data-demo-choice-group]")];
  groups.forEach((group) => {
    const buttons = [...group.querySelectorAll("[data-demo-choice]")];
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        setPressed(buttons, button);
        onChange();
        trackEvent("demo_interaction", {
          niche: document.body.dataset.demoType || "sector",
          component: root.dataset.agencyBrief
            ? "brief_builder"
            : root.dataset.commerceLab
              ? "product_recommender"
              : root.dataset.propertyConcierge
                ? "property_concierge"
                : "reservation_pass",
          action: group.dataset.demoChoiceGroup || "select",
          value: button.dataset.demoChoice || button.textContent.trim(),
        });
      });
    });
  });
};

// The lookup tables below are keyed by these values, so falling back to the first
// choice in the group keeps them addressable even if the markup ships without a
// default selection. The update() callers still guard, because a renamed choice
// would produce a valid string that no table knows about.
const selectedValue = (root, group) => {
  const scope = root.querySelector(`[data-demo-choice-group="${group}"]`);
  if (!scope) return "";
  const selected = scope.querySelector(".is-selected") || scope.querySelector("[data-demo-choice]");
  return selected?.dataset.demoChoice || "";
};

const setSelectValue = (selector, value) => {
  const select = document.querySelector(selector);
  if (select && [...select.options].some((option) => option.value === value)) {
    select.value = value;
  }
};

const setupAgencyBrief = () => {
  const root = document.querySelector("[data-agency-brief]");
  if (!root) return;
  const title = root.querySelector("[data-agency-output]");
  const note = root.querySelector("[data-agency-note]");
  const result = root.querySelector(".agency-brief-wall__result");
  const plans = {
    Lanzar: "Plan de lanzamiento",
    Posicionar: "Sistema de marca",
    Convertir: "Ruta de captación",
  };
  const update = () => {
    const goal = selectedValue(root, "goal");
    const channel = selectedValue(root, "channel");
    if (!title || !note || !plans[goal] || !channel) return;
    title.textContent = `${plans[goal]} · ${channel}`;
    note.textContent = `Ejemplo de plan para ${goal.toLowerCase()} mediante ${channel.toLowerCase()}, con estrategia, diseño y medición en un solo equipo.`;
    setSelectValue("[data-agency-goal]", goal);
    setSelectValue("[data-agency-channel]", channel);
    acknowledgeResult(root, result, "agency");
  };
  bindChoiceGroups(root, update);
  update();
};

const setupCommerceLab = () => {
  const root = document.querySelector("[data-commerce-lab]");
  if (!root) return;
  const product = root.querySelector("[data-commerce-product]");
  const description = root.querySelector("[data-commerce-description]");
  const result = root.querySelector(".commerce-lab__result");
  const image = document.querySelector("[data-commerce-image]");
  const data = {
    Movilidad: {
      name: "Nova X1",
      description: "Cámara profesional, batería de todo el día y cuerpo de titanio.",
      image: "/assets/demo-premium/ecommerce-hero.webp",
      srcset:
        "/assets/demo-premium/ecommerce-hero-480.webp 480w, /assets/demo-premium/ecommerce-hero-960.webp 960w, /assets/demo-premium/ecommerce-hero.webp 1698w",
    },
    Enfoque: {
      name: "NovaBook Air 15",
      description: "Un escritorio portátil para trabajar con menos ruido y más espacio.",
      image: "/assets/stitch/ecommerce-02.jpg",
      srcset: "/assets/stitch/ecommerce-02-480.webp 480w, /assets/stitch/ecommerce-02.jpg 512w",
    },
    Audio: {
      name: "Nova Sonic Pro",
      description: "Cancelación adaptable y una escucha diseñada para trayectos largos.",
      image: "/assets/stitch/ecommerce-04.jpg",
      srcset: "/assets/stitch/ecommerce-04-480.webp 480w, /assets/stitch/ecommerce-04.jpg 512w",
    },
  };
  const update = () => {
    const use = selectedValue(root, "use");
    const entry = data[use];
    if (!entry || !product || !description || !image) return;
    product.textContent = entry.name;
    description.textContent = entry.description;
    image.src = entry.image;
    image.srcset = entry.srcset;
    image.alt = `${entry.name}, recomendación ilustrativa de NovaStore`;
    setSelectValue("[data-commerce-inquiry-product]", entry.name);
    acknowledgeResult(root, result, "commerce");
  };
  bindChoiceGroups(root, update);
  document.querySelectorAll("[data-product-choice]").forEach((control) => {
    control.addEventListener("click", () => {
      setSelectValue("[data-commerce-inquiry-product]", control.dataset.productChoice);
      trackEvent("demo_interaction", {
        niche: "tienda online",
        component: "product_catalog",
        action: "select_product",
        value: control.dataset.productChoice,
      });
    });
  });
  update();
};

const setupPropertyConcierge = () => {
  const root = document.querySelector("[data-property-concierge]");
  if (!root) return;
  const title = root.querySelector("[data-property-title]");
  const meta = root.querySelector("[data-property-meta]");
  const image = root.querySelector("[data-property-image]");
  const code = root.querySelector("[data-property-code]");
  const result = root.querySelector(".property-concierge__result");
  const options = {
    Rosales: {
      Familiar: [
        "Casa Rosales 88",
        "4 hab · terraza · 312 m²",
        "/assets/stitch/property-rosales-960.webp",
      ],
      Inversión: [
        "Penthouse Rosales",
        "2 hab · renta premium · 184 m²",
        "/assets/stitch/property-virrey-960.webp",
      ],
    },
    Chicó: {
      Familiar: [
        "Reserva del Chicó",
        "3 hab · parque privado · 228 m²",
        "/assets/stitch/property-santa-ana-960.webp",
      ],
      Inversión: [
        "Loft Parque Virrey",
        "1 hab · amoblado · 92 m²",
        "/assets/stitch/property-virrey-960.webp",
      ],
    },
    Sabana: {
      Familiar: [
        "Casa de Chía",
        "4 hab · jardín · 420 m²",
        "/assets/stitch/property-chia-960.webp",
      ],
      Inversión: [
        "Retiro Anapoima",
        "3 hab · piscina · 360 m²",
        "/assets/stitch/property-anapoima-960.webp",
      ],
    },
  };
  const update = () => {
    const zone = selectedValue(root, "zone");
    const intent = selectedValue(root, "intent");
    const entry = options[zone]?.[intent];
    if (!entry || !title || !meta || !image || !code) return;
    const [name, detail, source] = entry;
    title.textContent = name;
    meta.textContent = detail;
    image.src = source;
    image.alt = `${name}, recomendación inmobiliaria ilustrativa`;
    code.textContent = `HP-${zone.slice(0, 2).toUpperCase()}-${intent.slice(0, 2).toUpperCase()}`;
    setSelectValue("[data-property-zone]", zone);
    setSelectValue("[data-property-intent]", intent);
    acknowledgeResult(root, result, "property");
  };
  bindChoiceGroups(root, update);
  update();
};

const setupRestaurantPass = () => {
  const root = document.querySelector("[data-restaurant-pass]");
  if (!root) return;
  const menu = root.querySelector("[data-restaurant-menu]");
  const detail = root.querySelector("[data-restaurant-detail]");
  const time = root.querySelector("[data-restaurant-time]");
  const result = root.querySelector(".restaurant-pass__result");
  const suggestions = {
    "Primera visita": ["Ruta de la brasa", "Cinco momentos · opción vegetal disponible"],
    Celebración: ["Mesa de fuego", "Siete momentos · ritmo pausado para compartir"],
    "Cena tranquila": ["Carta corta", "Tres platos · selección flexible a la mesa"],
  };
  const update = () => {
    const occasion = selectedValue(root, "occasion");
    const hour = selectedValue(root, "hour");
    const entry = suggestions[occasion];
    if (!entry || !menu || !detail || !time) return;
    menu.textContent = entry[0];
    detail.textContent = entry[1];
    time.textContent = hour;
    setSelectValue("[data-restaurant-occasion]", occasion);
    setSelectValue("[data-restaurant-form-time]", hour);
    acknowledgeResult(root, result, "restaurant");
  };
  bindChoiceGroups(root, update);
  update();
};

setupAgencyBrief();
setupCommerceLab();
setupPropertyConcierge();
setupRestaurantPass();
