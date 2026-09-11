// La interacción de esta demo es el alcance, no un configurador de copia.
// Elegir objetivo y punto de partida no cambia un titular: reescribe el
// documento entero, y la cláusula de lo que NO entra se escribe con el mismo
// cuerpo que la de lo que sí. El conflicto real de una agencia son las rondas
// infinitas, así que el número de rondas viaja dentro del alcance desde el
// primer minuto.
//
// Sustituye a `setupAgencyBrief` de `industry-demos.js`, que sigue cargado
// porque maneja el formulario simulado y lo comparten otras tres demos. Esa
// función busca `[data-agency-brief]` y esta página declara `[data-agency-scope]`,
// así que sale sola y no pelean por los mismos botones.

const scopes = {
  "Lanzar|Web": {
    title: "Lanzamiento con sitio propio",
    ref: "ALC-01",
    rounds: 2,
    weeks: "8 a 10 semanas",
    in: [
      "Estrategia de marca y mensajes",
      "Sistema visual aplicado",
      "Sitio corporativo hasta seis plantillas",
    ],
    out: ["Producción audiovisual", "Pauta y medios pagados", "Mantenimiento posterior al traspaso"],
  },
  "Lanzar|Contenido": {
    title: "Lanzamiento apoyado en contenido",
    ref: "ALC-02",
    rounds: 2,
    weeks: "6 a 8 semanas",
    in: ["Estrategia editorial", "Sistema visual para piezas", "Calendario de los tres primeros meses"],
    out: ["Sitio web", "Gestión diaria de redes", "Producción fotográfica"],
  },
  "Lanzar|Campaña": {
    title: "Lanzamiento con campaña de salida",
    ref: "ALC-03",
    rounds: 2,
    weeks: "5 a 7 semanas",
    in: ["Concepto de campaña", "Piezas para tres formatos", "Página de aterrizaje"],
    out: ["Compra de medios", "Sitio corporativo completo", "Informes mensuales de resultados"],
  },
  "Posicionar|Web": {
    title: "Reposicionamiento sobre el sitio actual",
    ref: "ALC-04",
    rounds: 3,
    weeks: "7 a 9 semanas",
    in: ["Mapa de posicionamiento", "Arquitectura y mensajes", "Rediseño de las páginas clave"],
    out: ["Migración de plataforma", "Contenido de blog", "Traducciones"],
  },
  "Posicionar|Contenido": {
    title: "Reposicionamiento por contenido",
    ref: "ALC-05",
    rounds: 3,
    weeks: "6 a 8 semanas",
    in: ["Mapa de posicionamiento", "Guía de voz y tono", "Doce piezas de muestra"],
    out: ["Rediseño del sitio", "Publicación continua", "Relaciones públicas"],
  },
  "Posicionar|Campaña": {
    title: "Reposicionamiento con campaña",
    ref: "ALC-06",
    rounds: 3,
    weeks: "6 a 8 semanas",
    in: ["Mapa de posicionamiento", "Concepto de campaña", "Piezas para dos canales"],
    out: ["Compra de medios", "Rediseño del sitio", "Estudios de mercado primarios"],
  },
  "Convertir|Web": {
    title: "Ruta de captación sobre el sitio",
    ref: "ALC-07",
    rounds: 2,
    weeks: "4 a 6 semanas",
    in: ["Auditoría de la ruta actual", "Rediseño de formularios y páginas de entrada", "Conexión con el CRM"],
    out: ["Rediseño de marca", "Contenido editorial", "Pauta y medios pagados"],
  },
  "Convertir|Contenido": {
    title: "Captación apoyada en contenido",
    ref: "ALC-08",
    rounds: 2,
    weeks: "5 a 7 semanas",
    in: ["Piezas de descarga", "Secuencia de seguimiento", "Medición de origen"],
    out: ["Rediseño de marca", "Gestión de comunidad", "Compra de medios"],
  },
  "Convertir|Campaña": {
    title: "Captación con campaña",
    ref: "ALC-09",
    rounds: 2,
    weeks: "4 a 6 semanas",
    in: ["Concepto y piezas", "Página de aterrizaje", "Panel de seguimiento"],
    out: ["Compra de medios", "Rediseño de marca", "Operación comercial del equipo"],
  },
};

const goalLabels = {
  Lanzar: "lanzar algo nuevo",
  Posicionar: "reposicionar la marca",
  Convertir: "convertir mejor",
};

const body = document.body;
const root = document.querySelector("[data-agency-scope]");

if (root) {
  const title = root.querySelector("[data-agency-title]");
  const ref = root.querySelector("[data-agency-ref]");
  const rounds = root.querySelector("[data-agency-rounds]");
  const clauses = root.querySelector("[data-agency-clauses]");
  const choices = [...root.querySelectorAll("[data-demo-choice]")];

  const groupOf = (button) => button.closest("[data-demo-choice-group]")?.dataset.demoChoiceGroup;

  const selected = (group) =>
    choices.find(
      (button) => groupOf(button) === group && button.getAttribute("aria-pressed") === "true",
    )?.dataset.demoChoice;

  const setSelect = (selector, value) => {
    const field = document.querySelector(selector);
    if (field && value) field.value = value;
  };

  const clause = (heading, flagText, flagTone, items) => {
    const item = document.createElement("li");
    item.className = flagTone === "out" ? "ag-clause ag-clause--out" : "ag-clause";

    const head = document.createElement("p");
    head.className = "ag-clause__title";
    head.append(heading);
    if (flagText) {
      const flag = document.createElement("span");
      flag.className = `ag-flag ag-flag--${flagTone}`;
      flag.textContent = flagText;
      head.append(flag);
    }

    const bodyLine = document.createElement("div");
    bodyLine.className = "ag-clause__body";
    const list = document.createElement("ul");
    for (const text of items) {
      // El guion o la cruz los pone el ::before de la hoja, que es la primera
      // celda de la rejilla; aquí solo viaja el texto.
      const entry = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = text;
      entry.append(label);
      list.append(entry);
    }
    bodyLine.append(list);

    item.append(head, bodyLine);
    return item;
  };

  const replayUpdate = () => {
    root.classList.remove("is-updating");
    void root.offsetWidth;
    root.classList.add("is-updating");
  };

  const update = () => {
    const goal = selected("goal");
    const channel = selected("channel");
    const scope = scopes[`${goal}|${channel}`];
    if (!scope) return;

    if (title) title.textContent = scope.title;
    if (ref) ref.textContent = `${scope.ref} · ${scope.weeks}`;
    if (rounds) {
      rounds.replaceChildren(
        document.createTextNode("Rondas de revisión incluidas: "),
        Object.assign(document.createElement("b"), { textContent: String(scope.rounds) }),
        document.createTextNode(". A partir de ahí se cotizan aparte, y eso se dice ahora, no al final."),
      );
    }

    if (clauses) {
      clauses.replaceChildren(
        clause("Qué entra", "Incluido", "in", scope.in),
        clause("Qué no entra", "Fuera", "out", scope.out),
      );
    }

    setSelect("[data-agency-goal]", goal);
    setSelect("[data-agency-channel]", channel);
    replayUpdate();

    const goalText = goalLabels[goal] || "un encargo";
    body.dataset.demoGoal = `Quiero una landing para mi agencia enfocada en ${goalText}`;
    window.dispatchEvent(
      new CustomEvent("luenio:demo-goal-change", { detail: { goal: body.dataset.demoGoal } }),
    );
  };

  for (const button of choices) {
    button.addEventListener("click", () => {
      const group = groupOf(button);
      for (const other of choices) {
        if (groupOf(other) !== group) continue;
        const isChosen = other === button;
        other.setAttribute("aria-pressed", String(isChosen));
        other.classList.toggle("is-selected", isChosen);
      }
      update();
    });
  }

  update();
}
