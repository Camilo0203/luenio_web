export const QUOTE_SERVICES = [
  "Landing page de conversión",
  "Automatización de WhatsApp",
  "Chatbot o asistente IA",
  "CRM y seguimiento",
  "Landing + automatización completa",
];

const knownSectors = new Set([
  "agencia",
  "tienda online",
  "gimnasio",
  "inmobiliaria",
  "restaurante",
]);

const knownDemos = new Set([
  "Impulso Digital",
  "NovaStore",
  "Titan Fitness Club",
  "Hogar Prime",
  "Sabor & Fuego",
]);

function cleanText(value, maxLength = 120) {
  return [...String(value || "")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanSource(value) {
  return cleanText(value, 48)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function readJourneyContext(search = globalThis.location?.search || "") {
  const params = new URLSearchParams(search);
  const sectorCandidate = cleanText(params.get("sector"), 40).toLowerCase();
  const demoCandidate = cleanText(params.get("demo"), 60);
  const serviceCandidate = cleanText(params.get("service"), 60);

  return {
    sector: knownSectors.has(sectorCandidate) ? sectorCandidate : "",
    demo: knownDemos.has(demoCandidate) ? demoCandidate : "",
    service: QUOTE_SERVICES.includes(serviceCandidate) ? serviceCandidate : "",
    goal: cleanText(params.get("goal"), 180),
    source: cleanSource(params.get("source")),
  };
}

export function buildQuoteUrl(context = {}) {
  const params = new URLSearchParams();
  const sector = cleanText(context.sector, 40).toLowerCase();
  const demo = cleanText(context.demo, 60);
  const service = cleanText(context.service, 60);
  const goal = cleanText(context.goal, 180);
  const source = cleanSource(context.source);

  if (knownSectors.has(sector)) params.set("sector", sector);
  if (knownDemos.has(demo)) params.set("demo", demo);
  if (QUOTE_SERVICES.includes(service)) params.set("service", service);
  if (goal) params.set("goal", goal);
  if (source) params.set("source", source);

  const query = params.toString();
  return query ? `/cotizacion?${query}` : "/cotizacion";
}

export function journeyAnalyticsProperties(context = {}) {
  return Object.fromEntries(
    Object.entries({
      sector: context.sector || "",
      demo: context.demo || "",
      journey_source: context.source || "",
    }).filter(([, value]) => value),
  );
}
