// El estado describe el ritmo de la pauta, nunca la disponibilidad: una demo
// que anuncia cupos afirma algo sobre una agenda que no existe, y mete presión
// de escasez en una página cuya tesis es que aquí no te venden de más.
//
// La interacción de esta demo es la pauta, no un configurador de copia. Elegir
// un motivo no cambia un párrafo: reescribe el calendario completo, porque en
// estética el valor está en el intervalo entre sesiones y en el punto de
// revisión, no en la sesión suelta.

const plans = {
  luminosidad: {
    title: "Pauta para luminosidad y textura",
    total: "4 citas · 5 semanas",
    status: { label: "Ritmo habitual", tone: "open" },
    steps: [
      ["Día 1", "Valoración facial", "Revisamos hábitos y textura visible, sin tratar todavía."],
      ["Misma semana", "Limpieza profunda", "Solo si la valoración lo confirma."],
      ["A los 15 días", "Segunda sesión", "El intervalo es parte del tratamiento, no una espera."],
      ["Al mes", "Revisión", "Decidimos si continuar, espaciar o parar."],
    ],
    goal: "Quiero una landing para mi estética enfocada en consultas de luminosidad",
  },
  sensibilidad: {
    title: "Pauta para piel sensible",
    total: "4 citas · 7 semanas",
    status: { label: "Ritmo prudente", tone: "wait" },
    steps: [
      ["Día 1", "Valoración facial", "Hablamos de reacciones previas antes de tocar la piel."],
      ["A los 7 días", "Prueba en zona pequeña", "Se prueba en una zona y se espera la respuesta."],
      ["A los 21 días", "Primera sesión completa", "Solo si la prueba salió bien."],
      ["A las 7 semanas", "Revisión", "Con piel reactiva vamos más lento a propósito."],
    ],
    goal: "Quiero una landing para mi estética enfocada en consultas de piel sensible",
  },
  continuidad: {
    title: "Pauta para mantener lo logrado",
    total: "Mensual · revisión cada 3 meses",
    status: { label: "Ritmo habitual", tone: "open" },
    steps: [
      ["Día 1", "Valoración facial", "Partimos de lo que ya se hizo y de cómo respondió."],
      [
        "Cada mes",
        "Plan de seguimiento",
        "Una sesión corta para sostener, no para empezar de cero.",
      ],
      ["Cada 3 meses", "Revisión", "Se ajusta la frecuencia o se espacia si ya no hace falta."],
    ],
    goal: "Quiero una landing para mi estética enfocada en seguimiento de cuidado",
  },
};

const body = document.body;
const choices = [...document.querySelectorAll("[data-skin-goal]")];
const schedule = document.querySelector("#aesthetics-schedule");
const planTitle = document.querySelector("[data-skin-plan-title]");
const planTotal = document.querySelector("[data-skin-plan-total]");
const planStatus = document.querySelector("[data-skin-plan-status]");
const stepList = document.querySelector("[data-skin-steps]");

function renderSteps(steps) {
  if (!stepList) return;
  stepList.replaceChildren(
    ...steps.map(([when, what, detail]) => {
      const item = document.createElement("li");
      item.className = "skin-step";

      const whenLine = document.createElement("p");
      whenLine.className = "skin-step__when";
      whenLine.textContent = when;

      const whatLine = document.createElement("p");
      whatLine.className = "skin-step__what";
      whatLine.textContent = what;

      const detailLine = document.createElement("p");
      detailLine.className = "skin-step__detail";
      detailLine.textContent = detail;

      item.append(whenLine, whatLine, detailLine);
      return item;
    }),
  );
}

function replayUpdate(target) {
  if (!target) return;
  target.classList.remove("is-updating");
  void target.offsetWidth;
  target.classList.add("is-updating");
}

function applyPlan(value) {
  const plan = plans[value] || plans.luminosidad;

  for (const choice of choices) {
    choice.setAttribute("aria-pressed", String(choice.dataset.skinGoal === value));
  }

  if (planTitle) planTitle.textContent = plan.title;
  if (planTotal) planTotal.textContent = plan.total;
  if (planStatus) {
    planStatus.textContent = plan.status.label;
    // El estado no viaja solo en el color: cambia la clase, y con ella el par
    // de color completo y el punto que la acompaña.
    planStatus.classList.toggle("skin-tag--open", plan.status.tone === "open");
    planStatus.classList.toggle("skin-tag--wait", plan.status.tone === "wait");
  }

  renderSteps(plan.steps);
  replayUpdate(schedule);

  body.dataset.demoGoal = plan.goal;
  window.dispatchEvent(new CustomEvent("luenio:demo-goal-change", { detail: { goal: plan.goal } }));
}

for (const choice of choices) {
  choice.addEventListener("click", () => applyPlan(choice.dataset.skinGoal));
}

applyPlan(
  choices.find((choice) => choice.getAttribute("aria-pressed") === "true")?.dataset.skinGoal ||
    "luminosidad",
);
