const paths = {
  general: {
    title: "Revisión con el equipo",
    copy: "Cuéntanos qué has observado antes de elegir horario.",
    goal: "Quiero una landing para mi veterinaria enfocada en consulta general",
  },
  prevention: {
    title: "Revisar el plan preventivo",
    copy: "Organiza vacunas, antecedentes y fechas antes de reservar.",
    goal: "Quiero una landing para mi veterinaria enfocada en prevención",
  },
  followup: {
    title: "Continuar un caso abierto",
    copy: "Comparte la evolución para que el equipo responda con contexto.",
    goal: "Quiero una landing para mi veterinaria enfocada en seguimiento",
  },
};

const body = document.body;
const buttons = [...document.querySelectorAll("[data-vet-care]")];
const title = document.querySelector("[data-vet-next-title]");
const copy = document.querySelector("[data-vet-next-copy]");
const answer = document.querySelector(".vet-route__answer");

function replayUpdate(target) {
  if (!target) return;
  target.classList.remove("is-updating");
  void target.offsetWidth;
  target.classList.add("is-updating");
}

function applyPath(value) {
  const path = paths[value] || paths.general;
  buttons.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.vetCare === value)),
  );
  if (title) title.textContent = path.title;
  if (copy) copy.textContent = path.copy;
  replayUpdate(answer);
  body.dataset.demoGoal = path.goal;
  window.dispatchEvent(new CustomEvent("luenio:demo-goal-change", { detail: { goal: path.goal } }));
}

buttons.forEach((button) =>
  button.addEventListener("click", () => applyPath(button.dataset.vetCare)),
);
applyPath("general");
