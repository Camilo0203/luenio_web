import { PUBLIC_JOURNEYS } from "./public-journeys.js";

export const QUOTE_SERVICES = [
  "Landing page de conversión",
  "Automatización de WhatsApp",
  "Chatbot o asistente IA",
  "CRM y seguimiento",
  "Landing + automatización completa",
];

const knownSectors = new Set(PUBLIC_JOURNEYS.map(({ sector }) => sector));
const knownDemos = new Set(PUBLIC_JOURNEYS.map(({ demo }) => demo));
const knownSources = new Set([
  "home_demo",
  ...PUBLIC_JOURNEYS.flatMap(({ id }) => [`landing_${id}`, `simulacion_${id}`]),
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

function resolveJourney(sectorCandidate, demoCandidate) {
  const sectorJourney = sectorCandidate
    ? PUBLIC_JOURNEYS.find(({ sector }) => sector === sectorCandidate) || null
    : null;
  const demoJourney = demoCandidate
    ? PUBLIC_JOURNEYS.find(({ demo }) => demo === demoCandidate) || null
    : null;

  if (sectorJourney && demoJourney && sectorJourney.id !== demoJourney.id) return null;
  return sectorJourney || demoJourney;
}

function isAllowedGoal(journey, goal) {
  if (!journey || !goal) return false;
  return [journey.goal, ...(journey.goalOptions || [])].includes(goal);
}

function emptyContext() {
  return { sector: "", demo: "", service: "", goal: "", source: "" };
}

export function readJourneyContext(search = globalThis.location?.search || "") {
  const params = new URLSearchParams(search);
  const sectorCandidate = cleanText(params.get("sector"), 40).toLowerCase();
  const demoCandidate = cleanText(params.get("demo"), 60);
  const serviceCandidate = cleanText(params.get("service"), 60);
  const goalCandidate = cleanText(params.get("goal"), 180);
  const sourceCandidate = cleanSource(params.get("source"));
  const journey = resolveJourney(sectorCandidate, demoCandidate);

  // A sector and demo are one identity. Never render a quote page with a
  // known sector combined with a known demo from a different journey.
  if ((sectorCandidate || demoCandidate) && !journey) return emptyContext();

  // A goal is meaningful only inside a valid journey. This prevents a
  // goal-only URL from producing misleading copy on the quote page.
  if (!journey) return emptyContext();

  return {
    sector: journey.sector,
    demo: journey.demo,
    service: QUOTE_SERVICES.includes(serviceCandidate) ? serviceCandidate : "",
    goal: isAllowedGoal(journey, goalCandidate) ? goalCandidate : "",
    source: knownSources.has(sourceCandidate) ? sourceCandidate : "",
  };
}

export function buildQuoteUrl(context = {}) {
  const params = new URLSearchParams();
  const sector = cleanText(context.sector, 40).toLowerCase();
  const demo = cleanText(context.demo, 60);
  const service = cleanText(context.service, 60);
  const goal = cleanText(context.goal, 180);
  const source = cleanSource(context.source);
  const journey = resolveJourney(
    knownSectors.has(sector) ? sector : "",
    knownDemos.has(demo) ? demo : "",
  );

  // Conflicting known identities are rejected as a unit, rather than
  // allowing a plausible-looking but semantically incorrect URL.
  if ((knownSectors.has(sector) || knownDemos.has(demo)) && !journey) return "/cotizacion";

  if (journey) {
    params.set("sector", journey.sector);
    params.set("demo", journey.demo);
  }
  if (QUOTE_SERVICES.includes(service)) params.set("service", service);
  if (journey && isAllowedGoal(journey, goal)) params.set("goal", goal);
  if (knownSources.has(source)) params.set("source", source);

  const query = params.toString();
  return query ? `/cotizacion?${query}` : "/cotizacion";
}

export function journeyAnalyticsProperties(context = {}) {
  return Object.fromEntries(
    Object.entries({
      sector: context.sector || "",
      demo: context.demo || "",
      service: context.service || "",
      source: context.source || "",
    }).filter(([, value]) => value),
  );
}

export { PUBLIC_JOURNEYS } from "./public-journeys.js";
