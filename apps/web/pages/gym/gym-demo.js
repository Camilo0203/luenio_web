import { trackEvent } from "../../src/analytics.js";

document.documentElement.classList.add("js");

const dayLabels = {
  today: "Hoy",
  tomorrow: "Mañana",
  saturday: "Sábado",
};

const dayKeys = Object.fromEntries(Object.entries(dayLabels).map(([key, value]) => [value, key]));

const routes = {
  "Ganar fuerza": {
    steps: [
      ["Activación", "Movilidad y preparación articular"],
      ["Fuerza", "Técnica guiada y bloque principal"],
      ["Movilidad", "Descarga y respiración"],
    ],
  },
  "Mejorar resistencia": {
    steps: [
      ["Activación", "Entrada progresiva en calor"],
      ["Conditioning", "Trabajo de ritmo y resistencia"],
      ["Recuperación", "Vuelta a la calma guiada"],
    ],
  },
  "Moverme mejor": {
    steps: [
      ["Respiración", "Control y preparación corporal"],
      ["Movilidad", "Rangos activos y estabilidad"],
      ["Integración", "Movimiento fluido y recuperación"],
    ],
  },
};

const zones = {
  Fuerza: {
    copy: "Racks, plataformas y acompañamiento técnico para progresar con seguridad.",
    fit: "Fuerza y técnica",
    mood: "Guiado y concentrado",
    image: "/assets/stitch/gym-05-480.webp",
    alt: "Zona de fuerza de la demo Titan Fitness Club",
    action: "Ver clases de fuerza",
  },
  Funcional: {
    copy: "Espacio abierto y estaciones versátiles para entrenar potencia, coordinación y resistencia.",
    fit: "Resistencia y potencia",
    mood: "Dinámico y colaborativo",
    image: "/assets/stitch/gym-01-480.webp",
    alt: "Zona funcional de la demo Titan Fitness Club",
    action: "Ver clases funcionales",
  },
  Recovery: {
    copy: "Una zona tranquila para movilidad, respiración y recuperación después de la sesión.",
    fit: "Movilidad y recuperación",
    mood: "Calmado y restaurativo",
    image: "/assets/stitch/gym-04-480.webp",
    alt: "Zona de recuperación de la demo Titan Fitness Club",
    action: "Ver clases de recovery",
  },
};

const trainers = {
  laura: {
    name: "Laura Méndez",
    focus: "Fuerza, fundamentos y técnica para avanzar con una base sólida.",
    specialty: "Técnica y progresión",
    next: "Hoy · 18:30",
    day: "Hoy",
    time: "18:30",
    action: "Ver sesión con Laura",
  },
  daniel: {
    name: "Daniel Cruz",
    focus: "Acondicionamiento y rendimiento con sesiones claras, medibles y bien dosificadas.",
    specialty: "Rendimiento",
    next: "Mañana · 07:00",
    day: "Mañana",
    time: "07:00",
    action: "Ver sesión con Daniel",
  },
  sofia: {
    name: "Sofía Rojas",
    focus: "Movilidad y recuperación para construir continuidad dentro y fuera del gimnasio.",
    specialty: "Movilidad y recovery",
    next: "Mañana · 19:30",
    day: "Mañana",
    time: "19:30",
    action: "Ver sesión con Sofía",
  },
};

const state = {
  goal: "Ganar fuerza",
  level: "Intermedio",
  time: "18:30",
  day: "Hoy",
  trainer: "laura",
  scheduleDay: "today",
  period: "all",
  progress: 0,
  pendingBooking: null,
  activeBooking: null,
};

const routeResult = document.querySelector(".route-result");
const routeSteps = document.querySelector("[data-route-steps]");
const summaryGoal = document.querySelector("[data-summary-goal]");
const summaryLevel = document.querySelector("[data-summary-level]");
const summaryTime = document.querySelector("[data-summary-time]");
const routeCode = document.querySelector("[data-route-code]");
const bookingDialog = document.querySelector("[data-booking-dialog]");
const bookingForm = bookingDialog?.querySelector("form");
const bookingName = document.querySelector("[data-booking-name]");
const bookingTime = document.querySelector("[data-booking-time]");
const bookingDate = document.querySelector("[data-booking-date]");
const bookingToast = document.querySelector("[data-booking-toast]");
const activeBookingPanel = document.querySelector("[data-active-booking]");
const itineraryComplete = document.querySelector("[data-itinerary-complete]");
const nameInput = bookingForm?.elements.namedItem("booking-name");
const phoneInput = bookingForm?.elements.namedItem("booking-phone");
let toastTimer = 0;

function updateClock() {
  const clock = document.querySelector("[data-live-clock]");
  if (!clock) return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function animateRoute() {
  if (!routeResult) return;
  routeResult.classList.remove("is-flipping");
  window.requestAnimationFrame(() => {
    routeResult.classList.add("is-flipping");
    window.setTimeout(() => routeResult.classList.remove("is-flipping"), 380);
  });
}

function renderItinerary(resetProgress = false) {
  const itinerary = document.querySelector("[data-itinerary]");
  const route = routes[state.goal];
  if (!itinerary || !route) return;
  if (resetProgress) state.progress = 0;

  itinerary.querySelectorAll("[data-itinerary-step]").forEach((item, index) => {
    const [title, detail] = route.steps[index];
    item.querySelector("strong").textContent = title;
    item.querySelector("small").textContent = detail;

    const action = item.querySelector("[data-complete-step]");
    const complete = index < state.progress;
    const current = index === state.progress && state.progress < route.steps.length;
    item.classList.toggle("is-complete", complete);
    item.classList.toggle("is-current", current);
    action.disabled = !current;
    action.textContent = complete ? "Completado" : current ? "Completar" : "Pendiente";
  });

  if (itineraryComplete) itineraryComplete.hidden = state.progress < route.steps.length;
}

function updateRoute() {
  const route = routes[state.goal];
  if (!route || !routeSteps) return;

  routeSteps.replaceChildren(
    ...route.steps.map(([step]) => {
      const item = document.createElement("li");
      item.textContent = step;
      return item;
    }),
  );
  if (summaryGoal) summaryGoal.textContent = state.goal;
  if (summaryLevel) summaryLevel.textContent = state.level;
  if (summaryTime) summaryTime.textContent = state.time;
  if (routeCode) {
    routeCode.textContent = `TF-${state.time.replace(":", "")}-${state.level.slice(0, 1).toUpperCase()}`;
  }
  renderItinerary(true);
  animateRoute();
}

function setPressedControl(selector, activeControl) {
  document.querySelectorAll(selector).forEach((control) => {
    const active = control === activeControl;
    control.classList.toggle("is-active", active);
    control.classList.toggle("is-selected", active);
    control.setAttribute("aria-pressed", String(active));
  });
}

document.querySelectorAll("[data-choice-group]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const choice = event.target.closest(".flap-choice");
    if (!choice) return;

    const groupName = group.dataset.choiceGroup;
    if (!groupName || !(groupName in state)) return;

    group.querySelectorAll(".flap-choice").forEach((button) => {
      const selected = button === choice;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    choice.classList.add("is-flipping");
    window.setTimeout(() => choice.classList.remove("is-flipping"), 380);
    state[groupName] = choice.dataset.value || choice.textContent.trim();
    updateRoute();
    trackEvent("demo_interaction", {
      niche: "gimnasio",
      component: "route_builder",
      action: groupName,
      value: state[groupName],
    });
  });
});

document.querySelectorAll("[data-route-day]").forEach((button) => {
  button.addEventListener("click", () => {
    state.day = button.dataset.routeDay;
    setPressedControl("[data-route-day]", button);
  });
});

function openBooking(name, time, day, sourceButton = null) {
  if (!bookingDialog) return;
  state.pendingBooking = { name, time, day, sourceButton };
  if (bookingName) bookingName.textContent = name;
  if (bookingTime) bookingTime.textContent = time;
  if (bookingDate) bookingDate.textContent = day;
  bookingForm?.reset();
  clearFieldErrors();
  bookingDialog.returnValue = "";
  bookingDialog.showModal();
  window.setTimeout(() => nameInput?.focus(), 50);
}

document.querySelector("[data-confirm-route]")?.addEventListener("click", (event) => {
  trackEvent("demo_interaction", {
    niche: "gimnasio",
    component: "route_builder",
    action: "confirm_route",
    value: `${state.goal} | ${state.level} | ${state.time}`,
  });
  openBooking(`${state.goal} · ${state.level}`, state.time, state.day, event.currentTarget);
});

document.querySelectorAll("[data-book-class]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest("[data-day-row]");
    const day = dayLabels[row?.dataset.dayRow] || "Hoy";
    openBooking(
      button.dataset.bookClass || "Clase Titan",
      button.dataset.bookTime || state.time,
      day,
      button,
    );
    trackEvent("demo_interaction", {
      niche: "gimnasio",
      component: "class_board",
      action: "open_booking",
      value: button.dataset.bookClass || "Clase Titan",
    });
  });
});

function showToast(title = "Reserva simulada", detail = "No se enviaron datos.") {
  if (!bookingToast) return;
  bookingToast.querySelector("strong").textContent = title;
  bookingToast.querySelector("small").textContent = detail;
  bookingToast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    bookingToast.hidden = true;
  }, 4200);
}

function clearFieldErrors() {
  document.querySelector("[data-name-error]").textContent = "";
  document.querySelector("[data-phone-error]").textContent = "";
  nameInput?.removeAttribute("aria-invalid");
  phoneInput?.removeAttribute("aria-invalid");
}

function validateField(input, target, message) {
  if (!(input instanceof HTMLInputElement)) return true;
  const valid = input.checkValidity();
  input.setAttribute("aria-invalid", String(!valid));
  document.querySelector(target).textContent = valid ? "" : message;
  return valid;
}

nameInput?.addEventListener("input", () =>
  validateField(nameInput, "[data-name-error]", "Escribe al menos dos caracteres."),
);
phoneInput?.addEventListener("input", () =>
  validateField(phoneInput, "[data-phone-error]", "Usa un número válido de 7 a 18 caracteres."),
);
nameInput?.addEventListener("invalid", () =>
  validateField(nameInput, "[data-name-error]", "Escribe al menos dos caracteres."),
);
phoneInput?.addEventListener("invalid", () =>
  validateField(phoneInput, "[data-phone-error]", "Usa un número válido de 7 a 18 caracteres."),
);

function saveBooking() {
  try {
    if (state.activeBooking) {
      sessionStorage.setItem("titan-demo-booking", JSON.stringify(state.activeBooking));
    } else {
      sessionStorage.removeItem("titan-demo-booking");
    }
  } catch {
    // The demo remains fully functional when storage is unavailable.
  }
}

function renderActiveBooking() {
  if (!activeBookingPanel) return;
  activeBookingPanel.hidden = !state.activeBooking;
  if (!state.activeBooking) {
    document.querySelectorAll("[data-book-class]").forEach((button) => {
      const row = button.closest(".class-row");
      const status = row?.querySelector(".class-status");
      button.disabled = false;
      button.textContent = "Reservar";
      row?.classList.remove("is-booked");
      if (status?.dataset.originalStatus) {
        status.textContent = status.dataset.originalStatus;
        status.className = status.dataset.originalClass;
      }
    });
    return;
  }

  activeBookingPanel.classList.add("is-visible");
  document.querySelector("[data-active-booking-name]").textContent = state.activeBooking.name;
  document.querySelector("[data-active-booking-day]").textContent = state.activeBooking.day;
  document.querySelector("[data-active-booking-time]").textContent = state.activeBooking.time;

  document.querySelectorAll("[data-book-class]").forEach((button) => {
    const row = button.closest("[data-day-row]");
    const status = row?.querySelector(".class-status");
    if (status && !status.dataset.originalStatus) {
      status.dataset.originalStatus = status.textContent;
      status.dataset.originalClass = status.className;
    }
    const day = dayLabels[row?.dataset.dayRow];
    const booked =
      button.dataset.bookClass === state.activeBooking.name &&
      button.dataset.bookTime === state.activeBooking.time &&
      day === state.activeBooking.day;
    button.disabled = booked;
    button.textContent = booked ? "Reservado" : "Reservar";
    row?.classList.toggle("is-booked", booked);
    if (status) {
      status.textContent = booked ? "Tu reserva" : status.dataset.originalStatus;
      status.className = booked ? "class-status is-booked-status" : status.dataset.originalClass;
    }
  });
}

bookingForm?.addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (!(submitter instanceof HTMLButtonElement) || !submitter.matches("[data-simulate-booking]"))
    return;
  event.preventDefault();
  const validName = validateField(
    nameInput,
    "[data-name-error]",
    "Escribe al menos dos caracteres.",
  );
  const validPhone = validateField(
    phoneInput,
    "[data-phone-error]",
    "Usa un número válido de 7 a 18 caracteres.",
  );
  if (!validName || !validPhone) {
    (validName ? phoneInput : nameInput)?.focus();
    return;
  }
  if (!state.pendingBooking) return;

  state.activeBooking = {
    name: state.pendingBooking.name,
    time: state.pendingBooking.time,
    day: state.pendingBooking.day,
  };
  saveBooking();
  renderActiveBooking();
  document.documentElement.dataset.bookingState = "confirmed";
  bookingDialog.close("confirm");
  showToast(
    "Reserva simulada confirmada",
    `${state.activeBooking.day} · ${state.activeBooking.time}`,
  );
});

bookingDialog?.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close("cancel");
});

bookingDialog?.addEventListener("close", () => {
  const sourceButton = state.pendingBooking?.sourceButton;
  if (bookingDialog.returnValue === "confirm" && !activeBookingPanel?.hidden) {
    activeBookingPanel.focus({ preventScroll: true });
  } else if (sourceButton instanceof HTMLElement && document.contains(sourceButton)) {
    sourceButton.focus({ preventScroll: true });
  }
  state.pendingBooking = null;
});

function renderSchedule() {
  let visibleCount = 0;
  document.querySelectorAll("[data-day-row]").forEach((row) => {
    const visibleDay = row.dataset.dayRow === state.scheduleDay;
    const visiblePeriod = state.period === "all" || row.dataset.periodRow === state.period;
    const visible = visibleDay && visiblePeriod;
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  const empty = document.querySelector("[data-empty-schedule]");
  if (empty) empty.hidden = visibleCount > 0;
}

document.querySelectorAll("[data-period]").forEach((filter) => {
  filter.addEventListener("click", () => {
    state.period = filter.dataset.period || "all";
    setPressedControl("[data-period]", filter);
    renderSchedule();
  });
});

document.querySelectorAll("[data-schedule-day]").forEach((filter) => {
  filter.addEventListener("click", () => {
    state.scheduleDay = filter.dataset.scheduleDay || "today";
    setPressedControl("[data-schedule-day]", filter);
    renderSchedule();
  });
});

document.querySelector("[data-start-route]")?.addEventListener("click", () => {
  state.progress = 0;
  renderItinerary();
  document.querySelector("#itinerario")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("[data-change-booking]")?.addEventListener("click", () => {
  if (!state.activeBooking) return;
  openBooking(state.activeBooking.name, state.activeBooking.time, state.activeBooking.day);
});

document.querySelector("[data-cancel-booking]")?.addEventListener("click", () => {
  state.activeBooking = null;
  saveBooking();
  renderActiveBooking();
  showToast("Reserva demostrativa cancelada", "Puedes elegir otra sesión.");
});

document.querySelector("[data-reset-progress]")?.addEventListener("click", () => {
  state.progress = 0;
  renderItinerary();
});

document.querySelector("[data-itinerary]")?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-complete-step]");
  if (!action || action.disabled) return;
  const step = Number(action.dataset.completeStep);
  if (step !== state.progress) return;
  state.progress += 1;
  renderItinerary();
});

function moveCompositeFocus(event, selector) {
  const controls = [...document.querySelectorAll(selector)];
  const currentIndex = controls.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % controls.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + controls.length) % controls.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = controls.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  controls[nextIndex].focus();
  controls[nextIndex].click();
}

function selectZone(button) {
  const selectedZone = button.dataset.zone;
  const zone = zones[selectedZone];
  if (!zone) return;

  document.querySelectorAll("[data-zone]").forEach((zoneButton) => {
    const selected = zoneButton === button;
    zoneButton.setAttribute("aria-selected", String(selected));
    zoneButton.tabIndex = selected ? 0 : -1;
  });
  document
    .querySelector("#zone-panel")
    ?.setAttribute("aria-labelledby", button.id || "zone-tab-strength");
  document.querySelectorAll("[data-zone-waypoint]").forEach((waypoint) => {
    waypoint.classList.toggle("is-active", waypoint.dataset.zoneWaypoint === selectedZone);
  });

  const image = document.querySelector("[data-zone-image]");
  image.classList.add("is-changing");
  window.setTimeout(() => {
    image.src = zone.image;
    image.alt = zone.alt;
    image.classList.remove("is-changing");
  }, 160);

  document.querySelector("[data-zone-title]").textContent = selectedZone;
  document.querySelector("[data-zone-copy]").textContent = zone.copy;
  document.querySelector("[data-zone-fit]").textContent = zone.fit;
  document.querySelector("[data-zone-mood]").textContent = zone.mood;
  document.querySelector("[data-zone-classes]").textContent = zone.action;
}

document.querySelectorAll("[data-zone]").forEach((button) => {
  button.addEventListener("click", () => selectZone(button));
  button.addEventListener("keydown", (event) => moveCompositeFocus(event, "[data-zone]"));
});

document.querySelector("[data-zone-classes]")?.addEventListener("click", () => {
  state.scheduleDay = "today";
  state.period = "all";
  const today = document.querySelector('[data-schedule-day="today"]');
  const all = document.querySelector('[data-period="all"]');
  if (today) setPressedControl("[data-schedule-day]", today);
  if (all) setPressedControl("[data-period]", all);
  renderSchedule();
  document.querySelector("#clases")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function selectTrainer(button) {
  const trainerKey = button.dataset.trainer;
  const trainer = trainers[trainerKey];
  if (!trainer) return;

  state.trainer = trainerKey;
  document.querySelectorAll("[data-trainer]").forEach((trainerButton) => {
    const selected = trainerButton === button;
    trainerButton.classList.toggle("is-selected", selected);
    trainerButton.setAttribute("aria-selected", String(selected));
    trainerButton.tabIndex = selected ? 0 : -1;
  });

  document.querySelector("[data-trainer-name]").textContent = trainer.name;
  document.querySelector("[data-trainer-focus]").textContent = trainer.focus;
  document.querySelector("[data-trainer-specialty]").textContent = trainer.specialty;
  document.querySelector("[data-trainer-next]").textContent = trainer.next;
  document.querySelector("[data-book-trainer]").textContent = trainer.action;
}

document.querySelectorAll("[data-trainer]").forEach((button) => {
  button.addEventListener("click", () => selectTrainer(button));
  button.addEventListener("keydown", (event) => moveCompositeFocus(event, "[data-trainer]"));
});

document.querySelector("[data-book-trainer]")?.addEventListener("click", (event) => {
  const trainer = trainers[state.trainer];
  openBooking(`Sesión con ${trainer.name}`, trainer.time, trainer.day, event.currentTarget);
});

const revealTargets = document.querySelectorAll(".reveal-on-scroll");
if (
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );
  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}

try {
  const storedBooking = JSON.parse(sessionStorage.getItem("titan-demo-booking") || "null");
  if (storedBooking?.name && storedBooking?.time && dayKeys[storedBooking.day]) {
    state.activeBooking = storedBooking;
  }
} catch {
  state.activeBooking = null;
}

renderItinerary();
renderSchedule();
renderActiveBooking();
updateClock();
document.documentElement.dataset.gymDemoReady = "true";
window.setInterval(updateClock, 30000);
