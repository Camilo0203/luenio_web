import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { buildQuoteUrl, readJourneyContext } from "../apps/web/src/journey-context.js";
import { getPublicJourneyById } from "../apps/web/src/public-journeys.js";
import { readPageHtml } from "./page-source.mjs";
import { SECTORS, getSector, nichePath } from "../config/sectors.js";
import { getNichePagePath, publicPageEntries } from "../lib/public-routes.js";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  // Pages declare their shared chrome with an include directive; read them
  // expanded so assertions see the markup that actually ships.
  if (filePath.endsWith(".html")) return readPageHtml(filePath);
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

const legalNotice =
  "© 2026 Luenio. Diseño y desarrollo de esta landing demostrativa. Todos los derechos reservados por Luenio.";
const disclaimer =
  "Las marcas, nombres, testimonios y datos mostrados son ficticios y se presentan únicamente con fines demostrativos.";

// Identity comes from the shared sector table; everything else in `pages` is
// what this test expects that landing to show. `brand` is compared against
// markup, so the ampersand arrives escaped.
function sectorIdentity(id) {
  const sector = getSector(id);
  return { slug: sector.id, journeyId: sector.id, brand: sector.brand.replace(/&/g, "&amp;") };
}

const pages = [
  {
    ...sectorIdentity("gym"),
    className: "gym-board",
    hero: "Construye tu ruta.",
    minSections: 5,
    ids: ["constructor", "itinerario", "clases", "zonas", "entrenadores"],
    terms: ["Ruta ilustrativa", "Reserva simulada", "Demo ficticia creada por Luenio"],
    primaryCta: "Crear mi ruta",
    conversionTarget: "constructor",
    asset: "/assets/stitch/gym-05.jpg",
    heroAsset: "/assets/demo-premium/gym-hero.webp",
    css: "/apps/web/pages/gym/gym-board.css",
    legalNotice: "Demo ficticia creada por Luenio.",
    disclaimer: "Esta demo no representa un cliente ni resultados reales.",
  },
  {
    ...sectorIdentity("restaurants"),
    className: "demo-restaurant",
    hero: "El fuego transforma cada ingrediente.",
    minSections: 10,
    ids: ["historia", "carta", "experiencia", "chef", "reservas", "ubicacion"],
    terms: ["$245.000", "Chapinero Alto", "Preguntas frecuentes"],
    primaryCta: "Solicitar reserva",
    conversionTarget: "reservas",
    successMessage: "Solicitud de reserva simulada.",
    asset: "/assets/demo-premium/restaurant-hero.webp",
    heroAsset: "/assets/demo-premium/restaurant-hero.webp",
  },
  {
    ...sectorIdentity("real-estate"),
    className: "demo-real-estate",
    hero: "Encuentra un lugar que esté a la altura de tu historia.",
    minSections: 5,
    maxSections: 5,
    ids: ["propiedades", "servicios", "preguntas", "contacto"],
    terms: ["Penthouse en Rosales", "$2.850.000.000 COP", "Asesoría de principio a fin"],
    primaryCta: "Solicitar asesoría",
    conversionTarget: "contacto",
    successMessage: "Solicitud de asesoría simulada.",
    asset: "/assets/stitch/property-rosales.webp",
    heroAsset: "/assets/demo-premium/real-estate-hero.webp",
    disclaimer:
      "Hogar Prime es una marca demostrativa. Las propiedades y precios son ejemplos y no corresponden a listados inmobiliarios vigentes.",
  },
  {
    ...sectorIdentity("ecommerce"),
    className: "demo-ecommerce",
    hero: "Potencia extraordinaria. Diseño esencial.",
    minSections: 9,
    ids: [
      "productos",
      "producto-destacado",
      "coleccion",
      "beneficios",
      "opiniones",
      "ayuda",
      "consulta",
    ],
    terms: ["Nova X1", "$3.899.000 COP", "Consulta de producto"],
    primaryCta: "Consultar producto",
    conversionTarget: "consulta",
    successMessage: "Consulta de producto simulada.",
    asset: "/assets/stitch/ecommerce-01.jpg",
    heroAsset: "/assets/demo-premium/ecommerce-hero.webp",
  },
  {
    ...sectorIdentity("agencies"),
    // Sale del stack `sector-v2`, que sigue vistiendo a restaurantes,
    // inmobiliaria y ecommerce. La firma legal se alinea con la de las otras
    // dos demos con mundo propio en vez de repetir el párrafo de derechos:
    // la reserva vive en la barra legal compartida, que esta página incluye.
    className: "agency-desk demo-agency",
    hero: "Construimos marcas digitales que avanzan.",
    minSections: 7,
    maxSections: 7,
    ids: ["servicios", "casos", "proceso", "planes", "propuesta"],
    terms: ["Mapa de posicionamiento", "Desde $12.500.000", "Lanzar y transferir"],
    primaryCta: "Solicitar propuesta",
    conversionTarget: "propuesta",
    successMessage: "Solicitud de propuesta simulada.",
    forbiddenTerms: [
      "Nexo Pay",
      "Habitat 72",
      "+31%",
      "Testimonios de muestra",
      "Directora ficticia",
    ],
    asset: "/assets/demo-premium/agency-hero.webp",
    heroAsset: "/assets/demo-premium/agency-hero.webp",
    legalNotice: "Demo ficticia creada por Luenio",
    disclaimer:
      "Impulso Digital es una marca demostrativa. Los entregables, alcances y precios son ejemplos y no representan proyectos ni resultados de clientes reales.",
    css: "/apps/web/pages/agencies/agency-desk.css",
  },
  {
    ...sectorIdentity("veterinary"),
    // Ya no es `care-landing`. Esta demo compartía plantilla, azul y esqueleto
    // con la de estéticas, así que quien abría las dos veía la plantilla en vez
    // de dos clínicas; ahora tiene hoja propia. La sección "equipo" se plegó
    // dentro de "ruta", que explica el recorrido completo en lugar de repetir
    // la misma idea en dos bloques.
    className: "vet-clinic veterinary",
    hero: "Del primer mensaje a una cita con contexto",
    minSections: 4,
    ids: ["servicios", "ruta", "agenda", "contacto"],
    terms: ["Consulta general", "Vacunas y prevención", "Seguimiento"],
    primaryCta: "Agendar consulta",
    conversionTarget: "agenda",
    legalNotice: "Demo ficticia creada por Luenio",
    disclaimer: "Información y disponibilidad ilustrativas",
    css: "/apps/web/pages/veterinary/vet-clinic.css",
  },
  {
    ...sectorIdentity("aesthetics"),
    // Ya no es `care-landing`. Era la otra mitad de la plantilla compartida con
    // veterinarias, así que al independizarse esa demo esta se quedó sola con
    // una hoja de dos dueños. Ahora tiene mundo propio y `care-landings.css`
    // desapareció por falta de consumidores.
    className: "skin-studio aesthetics",
    hero: "Primero entender, después tratar.",
    minSections: 4,
    ids: ["tratamientos", "agenda", "filosofia", "contacto"],
    terms: ["Valoración facial", "Limpieza profunda", "Plan de seguimiento"],
    primaryCta: "Reservar valoración",
    conversionTarget: "agenda",
    legalNotice: "Demo ficticia creada por Luenio",
    disclaimer: "Tratamientos y horarios ilustrativos",
    css: "/apps/web/pages/aesthetics/skin-studio.css",
  },
];

for (const page of pages) {
  const pagePath = `apps/web/pages/${page.slug}/index.html`;
  assert(fs.existsSync(path.join(root, pagePath)), `Missing niche landing: ${page.slug}`);
  const html = readText(pagePath);
  const normalizedHtml = html.replace(/\s+/g, " ");

  assert(html.includes('content="index, follow"'), `${page.slug} must be indexable.`);
  assert(html.includes(page.className), `${page.slug} must use its own visual identity.`);
  assert(html.includes(page.brand), `${page.slug} must present its sample brand.`);
  assert(html.includes(page.hero), `${page.slug} must include its final hero.`);
  if (page.asset) {
    assert(html.includes(page.asset), `${page.slug} must use a local visual asset.`);
  }
  if (page.heroAsset) {
    assert(html.includes(page.heroAsset), `${page.slug} must use its premium hero asset.`);
  }
  assert(
    (html.match(/<section\b/g) || []).length >= page.minSections,
    `${page.slug} is incomplete.`,
  );
  assert(
    !page.maxSections || (html.match(/<section\b/g) || []).length <= page.maxSections,
    `${page.slug} must preserve its distilled section count.`,
  );
  assert(
    page.ids.every((id) => html.includes(`id="${id}"`)),
    `${page.slug} is missing required sections.`,
  );
  assert(
    page.terms.every((term) => html.toLowerCase().includes(term.toLowerCase())),
    `${page.slug} is missing niche-specific commercial content.`,
  );
  const legacyConversion =
    html.includes(page.primaryCta) && html.includes(`href="#${page.conversionTarget}"`);
  const sharedConversion =
    html.includes("Cotizar mi solución") &&
    html.includes(`data-quote-cta="landing_${page.journeyId}"`);
  assert(
    legacyConversion || sharedConversion,
    `${page.slug} must expose a clear primary conversion path.`,
  );
  const staticContextualCta = html.match(
    new RegExp(`<a\\b[^>]*data-quote-cta="landing_${page.journeyId}"[^>]*>`, "s"),
  )?.[0];
  const staticContextualHref = staticContextualCta
    ?.match(/href="([^"]+)"/u)?.[1]
    ?.replaceAll("&amp;", "&");
  const staticContext = staticContextualHref
    ? readJourneyContext(new URL(staticContextualHref, "https://luenio.com").search)
    : null;
  const journey = getPublicJourneyById(page.journeyId);
  assert(
    journey &&
      staticContext?.sector === journey.sector &&
      staticContext.demo === journey.demo &&
      staticContext.service === journey.quoteService &&
      staticContext.source === `landing_${page.journeyId}`,
    `${page.slug} header CTA must preserve context without JavaScript.`,
  );
  assert(
    !page.successMessage || html.includes(`data-demo-success="${page.successMessage}`),
    `${page.slug} must explain the outcome of its demo conversion.`,
  );
  assert(
    (page.forbiddenTerms || []).every((term) => !html.toLowerCase().includes(term.toLowerCase())),
    `${page.slug} must not rely on fictional proof.`,
  );
  assert(
    normalizedHtml.includes(page.legalNotice || legalNotice),
    `${page.slug} must reserve the design to Luenio.`,
  );
  assert(
    normalizedHtml.includes(page.disclaimer || disclaimer),
    `${page.slug} must disclose fictional demo content.`,
  );
  assert(html.includes('href="/"'), `${page.slug} legal signature must link to Luenio.`);
  assert(
    html.includes(page.css || "/apps/web/src/niche-showcase.css"),
    `${page.slug} must use local CSS.`,
  );
  assert(html.includes("/apps/web/src/niche-landing.js"), `${page.slug} must use shared runtime.`);
  assert(!html.includes('href="#"'), `${page.slug} must not contain dead hash links.`);
  const images = [...html.matchAll(/<img\b[^>]*>/gs)].map((match) => match[0]);
  assert(
    images.every((image) => /\bwidth="\d+"/.test(image) && /\bheight="\d+"/.test(image)),
    `${page.slug} images must reserve intrinsic layout space.`,
  );
  if (images.length > 0) {
    const priorityImages = images.filter((image) => /\bfetchpriority="high"/.test(image));
    assert(
      priorityImages.length >= 1 &&
        priorityImages.every((image) => !/\bloading="lazy"/.test(image)),
      `${page.slug} must prioritize its above-the-fold visual.`,
    );
  }
  assert(
    /fonts\.googleapis\.com\/css2\?[^"]*wght@\d+\.\.\d+/.test(html),
    `${page.slug} must request variable font ranges instead of separate static weights.`,
  );
  assert(
    !/aida-public|cdn\.tailwindcss|tailwind-config/.test(html),
    `${page.slug} must be self-hosted.`,
  );
}

for (const page of pages) {
  if (!page.heroAsset) continue;
  const heroPath = path.join(root, "public", page.heroAsset.replace(/^\//, ""));
  const metadata = await sharp(heroPath).metadata();
  assert(
    metadata.format === "webp" && metadata.width >= 1600,
    `${page.slug} premium hero must be WebP and at least 1600px wide.`,
  );
  for (const width of [480, 960]) {
    const responsivePath = heroPath.replace(/\.webp$/, `-${width}.webp`);
    const responsiveMetadata = await sharp(responsivePath).metadata();
    assert(
      responsiveMetadata.format === "webp" && responsiveMetadata.width === width,
      `${page.slug} must include its ${width}px responsive hero.`,
    );
  }
}

const runtime = readText("apps/web/src/niche-landing.js");
[
  "demo_cta_click",
  "luenio_widget_open",
  "whatsapp_submit",
  "quote_form_open",
  "data-quote-link",
  "data-menu-toggle",
  "Escape",
].forEach((term) => assert(runtime.includes(term), `Shared niche runtime must include ${term}.`));

const contextualQuoteUrl = buildQuoteUrl({
  sector: "agencia",
  demo: "Impulso Digital",
  service: "Landing page de conversión",
  goal: "Quiero captar y calificar oportunidades para los clientes de mi agencia",
  source: "landing_agencies",
});
const contextualQuote = readJourneyContext(contextualQuoteUrl.split("?")[1]);
assert(
  contextualQuoteUrl.startsWith("/cotizacion?") &&
    contextualQuote.sector === "agencia" &&
    contextualQuote.demo === "Impulso Digital" &&
    contextualQuote.service === "Landing page de conversión" &&
    contextualQuote.goal ===
      "Quiero captar y calificar oportunidades para los clientes de mi agencia" &&
    contextualQuote.source === "landing_agencies",
  "Demo-to-quote context must round-trip through the shared contract.",
);
assert(
  !buildQuoteUrl({
    sector: "<script>",
    demo: "Cliente inventado",
    service: "Servicio arbitrario",
  }).includes("script"),
  "Quote context must reject unknown public values.",
);

const css = readText("apps/web/src/niche-showcase.css");
[".demo-gym", ".demo-restaurant", ".demo-real-estate", ".demo-ecommerce", ".demo-agency"].forEach(
  (selector) => assert(css.includes(selector), `Niche design system must include ${selector}.`),
);
assert(css.includes("prefers-reduced-motion"), "Niche pages must respect reduced motion.");
assert(
  css.includes("content-visibility: auto") && css.includes("contain-intrinsic-size"),
  "Long niche pages must defer offscreen rendering without layout collapse.",
);
assert(!/min\(100%\s*-/.test(css), "Niche responsive widths must use valid calc() syntax.");
const gymCss = readText("apps/web/pages/gym/gym-board.css");
assert(
  gymCss.includes("content-visibility: auto") && gymCss.includes("contain-intrinsic-size"),
  "The custom gym landing must defer offscreen rendering.",
);
const themeControl = readText("apps/web/src/theme-control.js");
assert(
  themeControl.includes('getPropertyValue("--page")'),
  "Theme color must follow each landing's own visual surface.",
);
const widgetCss = readText("apps/web/src/niche-widget.css");
assert(
  widgetCss.includes("--luenio-trigger-lift") &&
    widgetCss.includes(".luenio-wa__trigger.is-collision-hidden"),
  "The shared WhatsApp trigger must avoid covering landing controls.",
);
assert(widgetCss.includes("100dvh"), "Niche modal must support dynamic mobile viewports.");
assert(
  widgetCss.includes("safe-area-inset-bottom"),
  "Niche widget must respect device safe areas.",
);

const publicSources = [
  ...pages.map((page) => readText(`apps/web/pages/${page.slug}/index.html`)),
  readText("apps/web/pages/home/index.html"),
  readText("apps/web/pages/pricing/index.html"),
  runtime,
].join("\n");
assert(!publicSources.includes("Luenio Agency"), "The retired public brand must not return.");

// Routes and build entries are derived from config/sectors.js, so assert the
// derivation rather than the text that used to be typed out in both files.
const buildEntries = new Set(Object.values(publicPageEntries()));
SECTORS.forEach((sector) => {
  assert(getNichePagePath(`/${sector.id}`), `Server must route /${sector.id}.`);
  assert(getNichePagePath(nichePath(sector)), `Server must route ${nichePath(sector)}.`);
  assert(
    buildEntries.has(`apps/web/pages/${sector.id}/index.html`),
    `Vite must build the ${sector.id} landing.`,
  );
  assert(
    buildEntries.has(`apps/web/pages/demo/${sector.id}/index.html`),
    `Vite must build the ${sector.id} simulation.`,
  );
});

console.info("Niche landing conversion guard passed");
