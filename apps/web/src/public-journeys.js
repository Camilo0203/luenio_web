const freezeJourney = (journey) => Object.freeze(journey);

/**
 * Canonical public journeys. Keep the labels, URLs and context values here so
 * every public surface speaks about the same seven sector experiences.
 */
export const PUBLIC_JOURNEYS = Object.freeze([
  freezeJourney({
    id: "agencies",
    label: "Agencias",
    sector: "agencia",
    demo: "Impulso Digital",
    landingPath: "/agencias",
    simulationPath: "/demo/agencies",
    goal: "Quiero captar y calificar oportunidades para los clientes de mi agencia",
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "ecommerce",
    label: "Ecommerce",
    sector: "tienda online",
    demo: "NovaStore",
    landingPath: "/tiendas-online",
    simulationPath: "/demo/ecommerce",
    goal: "Quiero recuperar conversaciones de compra y darles seguimiento",
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "gym",
    label: "Gimnasios",
    sector: "gimnasio",
    demo: "Titan Fitness Club",
    landingPath: "/gimnasios",
    simulationPath: "/demo/gym",
    goal: "Quiero convertir consultas por precio en visitas y membresías",
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "real-estate",
    label: "Inmobiliarias",
    sector: "inmobiliaria",
    demo: "Hogar Prime",
    landingPath: "/inmobiliarias",
    simulationPath: "/demo/real-estate",
    goal: "Quiero calificar compradores y organizar el seguimiento inmobiliario",
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "restaurants",
    label: "Restaurantes",
    sector: "restaurante",
    demo: "Sabor & Fuego",
    landingPath: "/restaurantes",
    simulationPath: "/demo/restaurants",
    goal: "Quiero organizar reservas, pedidos y seguimiento desde WhatsApp",
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "veterinary",
    label: "Veterinarias",
    sector: "veterinaria",
    demo: "Huella Veterinaria",
    landingPath: "/veterinarias",
    simulationPath: "/demo/veterinary",
    goal: "Quiero convertir consultas de mascotas en citas atendidas",
    goalOptions: [
      "Quiero convertir consultas de mascotas en citas atendidas",
      "Quiero una landing para mi veterinaria",
      "Quiero una landing para mi veterinaria enfocada en consulta general",
      "Quiero una landing para mi veterinaria enfocada en prevención",
      "Quiero una landing para mi veterinaria enfocada en seguimiento",
    ],
    quoteService: "Landing + automatización completa",
  }),
  freezeJourney({
    id: "aesthetics",
    label: "Estéticas",
    sector: "estética",
    demo: "Aura Estética",
    landingPath: "/esteticas",
    simulationPath: "/demo/aesthetics",
    goal: "Quiero convertir consultas de tratamientos en valoraciones",
    goalOptions: [
      "Quiero convertir consultas de tratamientos en valoraciones",
      "Quiero una landing para mi estética",
      "Quiero una landing para mi estética enfocada en consultas de luminosidad",
      "Quiero una landing para mi estética enfocada en consultas de sensibilidad",
      "Quiero una landing para mi estética enfocada en seguimiento de cuidado",
    ],
    quoteService: "Landing + automatización completa",
  }),
]);

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getPublicJourneyById(id) {
  const candidate = normalize(id);
  return PUBLIC_JOURNEYS.find((journey) => journey.id === candidate) || null;
}

export function getPublicJourneyBySector(sector) {
  const candidate = normalize(sector);
  return PUBLIC_JOURNEYS.find((journey) => journey.sector === candidate) || null;
}

export function getPublicJourneyByDemo(demo) {
  const candidate = normalize(demo);
  return PUBLIC_JOURNEYS.find((journey) => normalize(journey.demo) === candidate) || null;
}

export function getPublicJourneyBySimulationType(type) {
  const candidate = normalize(type).replace(/^\/demo\//u, "");
  return (
    PUBLIC_JOURNEYS.find((journey) => journey.simulationPath.endsWith(`/${candidate}`)) || null
  );
}

export function getPublicJourney(value) {
  const candidate = normalize(value);
  return (
    PUBLIC_JOURNEYS.find(
      (journey) =>
        journey.id === candidate ||
        journey.sector === candidate ||
        normalize(journey.demo) === candidate ||
        normalize(journey.label) === candidate ||
        journey.landingPath === value ||
        journey.simulationPath === value,
    ) || null
  );
}
