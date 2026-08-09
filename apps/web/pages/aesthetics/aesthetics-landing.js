const choices = {
  luminosidad: {
    title: "Escuchar la piel",
    copy: "La luminosidad se conversa desde hábitos y textura visible, no desde una tendencia.",
    goal: "Quiero una landing para mi estética enfocada en consultas de luminosidad",
  },
  sensibilidad: {
    title: "Priorizar la tolerancia",
    copy: "La sensibilidad pide contexto sobre hábitos y reacciones antes de sugerir un siguiente paso.",
    goal: "Quiero una landing para mi estética enfocada en consultas de sensibilidad",
  },
  continuidad: {
    title: "Sostener el cuidado",
    copy: "La continuidad organiza una rutina simple y el momento adecuado para revisarla.",
    goal: "Quiero una landing para mi estética enfocada en seguimiento de cuidado",
  },
};

const body = document.body;
const inputs = [...document.querySelectorAll('input[name="focus"]')];
const title = document.querySelector("[data-aura-focus-title]");
const copy = document.querySelector("[data-aura-focus-copy]");
const bookingCopy = document.querySelector("[data-aura-booking-copy]");
const analysis = document.querySelector("#aura-analysis-result");

function replayUpdate(target) {
  if (!target) return;
  target.classList.remove("is-updating");
  void target.offsetWidth;
  target.classList.add("is-updating");
}

function applyChoice(value) {
  const choice = choices[value] || choices.luminosidad;
  if (title) title.textContent = choice.title;
  if (copy) copy.textContent = choice.copy;
  if (bookingCopy) {
    bookingCopy.textContent = `Prioridad: ${value}. Horario y tratamiento por confirmar con el equipo.`;
  }
  replayUpdate(analysis);
  body.dataset.demoGoal = choice.goal;
  window.dispatchEvent(
    new CustomEvent("luenio:demo-goal-change", { detail: { goal: choice.goal } }),
  );
}

inputs.forEach((input) => input.addEventListener("change", () => applyChoice(input.value)));
applyChoice(inputs.find((input) => input.checked)?.value);
