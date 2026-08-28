import fs from "node:fs";
import path from "node:path";
import { createDemoScenario, demoTypes, normalizeDemoType } from "../core/demo-simulator/index.js";
import { buildQuoteUrl, readJourneyContext } from "../apps/web/src/journey-context.js";
import { PUBLIC_JOURNEYS } from "../apps/web/src/public-journeys.js";
import { sanitizeAnalyticsProperties } from "../apps/web/src/analytics.js";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// Prettier owns the line breaks in these templates, so copy assertions have to
// compare words rather than exact source text or reformatting looks like a
// missing disclosure.
function readCollapsedText(filePath) {
  return readText(filePath).replace(/\s+/gu, " ");
}

const disclosureText =
  "Experiencia demostrativa de Luenio · No representa un cliente real ni resultados reales.";

assert(PUBLIC_JOURNEYS.length === 7, "Public journey metadata must register seven sectors.");
PUBLIC_JOURNEYS.forEach((journey) => {
  const contextUrl = buildQuoteUrl({
    sector: journey.sector,
    demo: journey.demo,
    service: journey.quoteService,
    goal: journey.goal,
    source: `simulacion_${journey.id}`,
  });
  const roundTrip = readJourneyContext(contextUrl.split("?")[1]);
  assert(
    roundTrip.sector === journey.sector &&
      roundTrip.demo === journey.demo &&
      roundTrip.service === journey.quoteService &&
      roundTrip.goal === journey.goal &&
      roundTrip.source === `simulacion_${journey.id}`,
    `${journey.id} quote context must round-trip through the canonical metadata.`,
  );

  const simulationHtml = readText(`apps/web/pages${journey.simulationPath}/index.html`);
  assert(
    readCollapsedText(`apps/web/pages/${journey.id}/index.html`).includes(disclosureText),
    `${journey.id} landing must show its disclosure.`,
  );
  assert(
    readCollapsedText(`apps/web/pages${journey.simulationPath}/index.html`).includes(
      disclosureText,
    ),
    `${journey.id} simulation must show its disclosure.`,
  );
  assert(
    (simulationHtml.match(/href="\/demo\//gu) || []).length >= 7,
    `${journey.id} simulation must expose all seven sector experiences in its selector.`,
  );
});

const conflictingContext = buildQuoteUrl({
  sector: "agencia",
  demo: "Huella Veterinaria",
  service: "Landing + automatización completa",
  goal: "Quiero captar y calificar oportunidades para los clientes de mi agencia",
  source: "simulacion_agencies",
});
assert(
  conflictingContext === "/cotizacion",
  "Quote context must reject known sector/demo combinations from different journeys.",
);
assert(
  readJourneyContext("?goal=objetivo%20arbitrario&source=simulacion_agencies").sector === "",
  "Quote context must reject a goal without a valid canonical journey.",
);
const veterinaryOption = buildQuoteUrl({
  sector: "veterinaria",
  demo: "Huella Veterinaria",
  goal: "Quiero una landing para mi veterinaria enfocada en prevención",
  source: "landing_veterinary",
});
assert(
  readJourneyContext(veterinaryOption.split("?")[1]).goal.includes("prevención"),
  "Veterinary interactive goals must remain canonical and round-trip to the quote flow.",
);
const aestheticsOption = buildQuoteUrl({
  sector: "estética",
  demo: "Aura Estética",
  goal: "Quiero una landing para mi estética enfocada en consultas de luminosidad",
  source: "landing_aesthetics",
});
assert(
  readJourneyContext(aestheticsOption.split("?")[1]).goal.includes("luminosidad"),
  "Aesthetics interactive goals must remain canonical and round-trip to the quote flow.",
);

const sanitizedAnalytics = sanitizeAnalyticsProperties({
  sector: "agencia",
  demo: "Impulso Digital",
  service: "Landing + automatización completa",
  source: "test",
  cta_location: "quote_form",
  name: "No debe salir",
  phone: "+57 300 000 0000",
  message: "Tampoco debe salir",
});
assert(
  !("name" in sanitizedAnalytics) &&
    !("phone" in sanitizedAnalytics) &&
    !("message" in sanitizedAnalytics),
  "Analytics properties must exclude PII fields.",
);

[
  "apps/web/pages/home",
  "apps/web/pages/demo/restaurants",
  "apps/web/pages/demo/real-estate",
  "apps/web/pages/demo/gym",
  "apps/web/pages/demo/ecommerce",
  "apps/web/pages/demo/agencies",
  "apps/web/pages/demo/veterinary",
  "apps/web/pages/demo/aesthetics",
  "apps/web/components",
  "apps/web/src/demo-engine",
  "apps/web/demo-engine",
  "apps/web/landing",
  "apps/admin/crm",
  "apps/admin/dashboard",
  "apps/admin/pipeline",
  "api/leads",
  "api/auth",
  "api/billing",
  "api/automation",
  "core/lead-engine",
  "core/scoring",
  "core/pipeline",
  "core/demo-simulator",
].forEach((directory) => {
  assert(
    fs.existsSync(path.join(root, directory)),
    `Missing scalable SaaS directory: ${directory}`,
  );
});

const webDemoEngineSource = readText("apps/web/src/demo-engine/index.js");
const compatibilityDemoEngineSource = readText("apps/web/demo-engine/index.js");
const industryDemoRuntimeSource = readText("apps/web/src/demo-engine/industry-demo-runtime.js");
const industrySimulationSource = readText("apps/web/src/industry-simulations.js");
const themeControlSource = readText("apps/web/src/theme-control.js");
const coreDemoEngineSource = readText("core/demo-simulator/index.js");
assert(
  webDemoEngineSource.includes("../../../../core/demo-simulator/index.js"),
  "Web src demo engine must reuse the core demo simulator.",
);
assert(
  compatibilityDemoEngineSource.includes("../src/demo-engine/index.js"),
  "Legacy web demo engine path must re-export the src demo engine.",
);
assert(
  industryDemoRuntimeSource.includes("mountIndustryDemo"),
  "Web demo engine must expose a reusable industry demo runtime.",
);
assert(
  industryDemoRuntimeSource.includes("advanceScenario"),
  "Industry demo runtime must drive the shared scenario engine.",
);
assert(
  industryDemoRuntimeSource.includes("createDemoScenario"),
  "Industry demo runtime must create scenarios from shared config.",
);
assert(
  industryDemoRuntimeSource.includes("submitPublicInquiry"),
  "Industry demo runtime must convert demo users through public lead capture.",
);
assert(
  industryDemoRuntimeSource.includes("demoCaptureForm"),
  "Industry demo runtime must render a shared lead capture form.",
);
assert(
  themeControlSource.includes('document.body.matches(".simulation-page")'),
  "Fixed-palette legacy simulations must not expose a misleading theme toggle.",
);
assert(
  industryDemoRuntimeSource.includes("industry_demo_"),
  "Industry demo runtime must preserve industry source attribution.",
);
[
  "simulation_start",
  "simulation_complete",
  "simulation_abandon",
  "simulation_quote_click",
  "simulation_whatsapp_click",
  "generate_lead",
  "buildQuoteUrl",
].forEach((term) =>
  assert(
    industrySimulationSource.includes(term),
    `Industry simulations must include the conversion contract: ${term}.`,
  ),
);
assert(
  industryDemoRuntimeSource.includes("autoStart"),
  "Industry demo runtime must auto-start demos for a live-system first impression.",
);
assert(
  coreDemoEngineSource.includes("export function createDemoScenario"),
  "Core demo simulator must expose createDemoScenario.",
);
assert(
  coreDemoEngineSource.includes("export function advanceScenario"),
  "Core demo simulator must expose advanceScenario.",
);
assert(
  coreDemoEngineSource.includes("export function normalizeDemoType"),
  "Core demo simulator must expose normalizeDemoType.",
);
assert(
  !coreDemoEngineSource.includes("../../apps/"),
  "Core demo simulator must not depend on app-layer code.",
);

[
  ["restaurant", "restaurants"],
  ["agency", "agencies"],
  ["real-estate", "real-estate"],
  ["gym", "gym"],
  ["ecommerce", "ecommerce"],
  ["veterinaria", "veterinary"],
  ["estetica", "aesthetics"],
].forEach(([input, expected]) => {
  assert(
    normalizeDemoType(input) === expected,
    `Demo engine must normalize ${input} to ${expected}.`,
  );
  assert(
    createDemoScenario(input).type === expected,
    `Demo scenario must accept ${input} as an engine type.`,
  );
});

["restaurants", "real-estate", "gym", "ecommerce", "agencies", "veterinary", "aesthetics"].forEach(
  (type) => {
    assert(demoTypes.includes(type), `Demo engine must register ${type}.`);
    const scenario = createDemoScenario(type);
    assert(scenario.type === type, `Scenario type must stay ${type}.`);
    assert(
      scenario.steps.length === 5,
      `${type} demo must expose the full five-step automation loop.`,
    );
    [
      "Lead recibido",
      "Analizando intención",
      "Lead calificado",
      "Enviado al CRM",
      "Automatización activada",
    ].forEach((stepLabel) => {
      assert(
        scenario.steps.some((step) => step.label.includes(stepLabel)),
        `${type} demo must include ${stepLabel}.`,
      );
    });
    assert(
      scenario.steps.some((step) => step.label.includes("CALIENTE 🔥")),
      `${type} demo must show hot scoring with visual urgency.`,
    );

    const pagePath = `apps/web/pages/demo/${type}/index.html`;
    const html = readText(pagePath);
    const normalizedHtml = html.replace(/\s+/gu, " ");
    assert(
      normalizedHtml.includes("Simulación ficticia.") &&
        normalizedHtml.includes("datos ilustrativos") &&
        normalizedHtml.includes("reglas deterministas, no mediante IA"),
      `${pagePath} must disclose fictional content, illustrative data and rule-based classification.`,
    );
    assert(
      !/\b(?:la\s+)?IA\s+(?:detect\w*|calific\w*)/iu.test(html),
      `${pagePath} must not claim that AI detects or qualifies leads.`,
    );
    assert(
      !normalizedHtml.replaceAll(disclosureText, "").includes("cliente real"),
      `${pagePath} must not present a fictional user as real.`,
    );
    assert(
      html.includes('content="noindex, nofollow"'),
      `${pagePath} must stay noindex while demos are campaign/internal assets.`,
    );
    assert(
      html.includes(`data-demo-type="${type}"`),
      `${pagePath} must only configure its demo type.`,
    );
    if (type === "restaurants") {
      assert(
        html.includes("/apps/web/pages/demo/restaurants/restaurant-demo.js"),
        `${pagePath} must use the restaurant demo UI script.`,
      );
    } else if (type === "real-estate") {
      assert(
        html.includes("/apps/web/pages/demo/real-estate/real-estate-demo.js"),
        `${pagePath} must use the real estate demo UI script.`,
      );
    } else if (type === "gym") {
      assert(
        html.includes("/apps/web/pages/demo/gym/gym-demo.js"),
        `${pagePath} must use the gym demo UI script.`,
      );
    } else if (type === "ecommerce") {
      assert(
        html.includes("/apps/web/pages/demo/ecommerce/ecommerce-demo.js"),
        `${pagePath} must use the ecommerce demo UI script.`,
      );
    } else if (type === "agencies") {
      assert(
        html.includes("/apps/web/pages/demo/agencies/agency-demo.js"),
        `${pagePath} must use the agency demo UI script.`,
      );
    } else if (type === "veterinary") {
      assert(
        html.includes("/apps/web/pages/demo/veterinary/veterinary-demo.js"),
        `${pagePath} must use the veterinary demo UI script.`,
      );
    } else if (type === "aesthetics") {
      assert(
        html.includes("/apps/web/pages/demo/aesthetics/aesthetics-demo.js"),
        `${pagePath} must use the aesthetics demo UI script.`,
      );
    } else {
      assert(
        html.includes("/apps/web/pages/demo/demo-page.js"),
        `${pagePath} must use the shared demo page script.`,
      );
    }
    assert(!html.includes("createDemoScenario("), `${pagePath} must not inline demo logic.`);
  },
);

const serverSource = readText("server.js");
[
  "/demo",
  "/demo/restaurants",
  "/demo/real-estate",
  "/demo/gym",
  "/demo/ecommerce",
  "/demo/agencies",
  "/demo/veterinary",
  "/demo/aesthetics",
].forEach((route) => {
  assert(serverSource.includes(route), `Server must route ${route}.`);
});

const viteSource = readText("vite.config.js");
[
  "demoRestaurants",
  "demoRealEstate",
  "demoGym",
  "demoEcommerce",
  "demoAgencies",
  "demoVeterinary",
  "demoAesthetics",
].forEach((entryName) => {
  assert(viteSource.includes(entryName), `Vite build must include ${entryName}.`);
});

const landingSource = readText("apps/web/pages/home/index.html");
assert(
  landingSource.includes("Tu próxima solución digital, lista para vender y dar seguimiento.") &&
    landingSource.includes("conectamos cada contacto con WhatsApp"),
  "Landing must open with a clear trust-first value proposition.",
);
assert(
  landingSource.includes("Explorar demos") &&
    landingSource.includes('data-quote-cta="hero"') &&
    landingSource.includes('href="/cotizacion"'),
  "Landing must prioritize demo exploration while preserving the quote path.",
);
assert(
  !landingSource.includes('href="/demo"'),
  "Trust-first landing must not route users into demo selection as the primary flow.",
);
assert(
  !landingSource.includes("live-demo-section"),
  "Trust-first landing must not expose fake live demo sections.",
);
assert(
  !landingSource.includes("See how many sales you're missing"),
  "Trust-first landing must not keep competing demo CTAs.",
);
const demoSelectorSource = readText("apps/web/pages/demo/index.html");
assert(
  demoSelectorSource.includes('content="index, follow"') &&
    demoSelectorSource.includes('href="https://luenio.com/demos"'),
  "Demo selector must expose its indexable canonical catalog route.",
);
assert(
  demoSelectorSource.includes("Demos por sector"),
  "Demo selector must clearly invite users to try an industry demo.",
);
assert(
  demoSelectorSource.includes("Explorar experiencia") && !demoSelectorSource.includes(">Ver demo<"),
  "Demo selector must use clear exploratory CTAs.",
);
assert(
  demoSelectorSource.includes("Explora cómo podría funcionar tu próxima solución."),
  "Demo selector must frame demos around the visitor's next solution.",
);
assert(
  demoSelectorSource.includes("WhatsApp y automatizaciones trabajando juntas"),
  "Demo selector must explain the connected Luenio experience.",
);
const catalogLandingRoutes = [
  "/agencias",
  "/tiendas-online",
  "/gimnasios",
  "/inmobiliarias",
  "/restaurantes",
  "/veterinarias",
  "/esteticas",
];
catalogLandingRoutes.forEach((route) => {
  assert(
    demoSelectorSource.includes(`href="${route}"`),
    `Demo selector must link its primary card to the modern landing ${route}.`,
  );
});
assert(
  !/href="\/demos?\/(?:restaurants|real-estate|gym|ecommerce|agencies|veterinary|aesthetics)"/u.test(
    demoSelectorSource,
  ),
  "Demo selector must not send primary cards to legacy simulations.",
);

const sharedDemoPageSource = readText("apps/web/pages/demo/demo-page.js");
assert(
  sharedDemoPageSource.includes("submitPublicInquiry"),
  "Interactive demos must include lead capture through the public contact API.",
);
assert(
  sharedDemoPageSource.includes("demoCaptureForm"),
  "Interactive demos must render a lead capture form.",
);
assert(
  sharedDemoPageSource.includes("industry_demo_"),
  "Demo lead capture must preserve industry source attribution.",
);
assert(
  sharedDemoPageSource.includes("../../src/demo-engine/index.js"),
  "Shared demo page must use the src demo engine.",
);

const restaurantDemoHtml = readText("apps/web/pages/demo/restaurants/index.html");
const restaurantDemoSource = readText("apps/web/pages/demo/restaurants/restaurant-demo.js");
assert(
  restaurantDemoHtml.includes("Interfaz de simulación de chat"),
  "Restaurant demo must expose a chat simulation UI.",
);
assert(
  restaurantDemoHtml.includes("Panel lateral de CRM"),
  "Restaurant demo must expose a CRM side panel.",
);
assert(
  restaurantDemoHtml.includes("Ejecutar Demo en Vivo"),
  "Restaurant demo must expose a Live Demo Mode indicator/control.",
);
assert(
  restaurantDemoHtml.includes("Un WhatsApp sin respuesta es un pedido que se va."),
  "Restaurant demo must emphasize lost WhatsApp orders.",
);
assert(
  restaurantDemoSource.includes("mountIndustryDemo"),
  "Restaurant demo must use the shared industry demo runtime.",
);
assert(
  restaurantDemoSource.includes('type: "restaurants"'),
  "Restaurant demo must only configure its industry type.",
);
assert(
  !restaurantDemoSource.includes("advanceScenario"),
  "Restaurant demo must not duplicate scenario engine logic.",
);
assert(
  !restaurantDemoSource.includes("window.setTimeout"),
  "Restaurant demo must not own timer orchestration.",
);
assert(
  restaurantDemoSource.includes("Pedido capturado"),
  "Restaurant demo must show captured order feedback.",
);
assert(
  restaurantDemoSource.includes("Lead calificado:"),
  "Restaurant demo must show scoring feedback.",
);
assert(
  restaurantDemoSource.includes("Cliente movido al pipeline CALIENTE"),
  "Restaurant demo must show CRM HOT pipeline movement.",
);

const realEstateDemoHtml = readText("apps/web/pages/demo/real-estate/index.html");
const realEstateDemoSource = readText("apps/web/pages/demo/real-estate/real-estate-demo.js");
const realEstateScenario = createDemoScenario("real-estate");
assert(
  realEstateDemoHtml.includes("Simulación de chat de comprador"),
  "Real estate demo must expose a buyer chat simulation.",
);
assert(
  realEstateDemoHtml.includes("Panel de coincidencia de propiedades"),
  "Real estate demo must expose property matching.",
);
assert(
  realEstateDemoHtml.includes("Visualización de CRM"),
  "Real estate demo must expose CRM visualization.",
);
assert(
  realEstateDemoHtml.includes("Ejecutar Demo en Vivo"),
  "Real estate demo must expose a Live Demo Mode control.",
);
assert(
  realEstateDemoSource.includes("mountIndustryDemo"),
  "Real estate demo must use the shared industry demo runtime.",
);
assert(
  realEstateDemoSource.includes('type: "real-estate"'),
  "Real estate demo must only configure its industry type.",
);
assert(
  !realEstateDemoSource.includes("advanceScenario"),
  "Real estate demo must not duplicate scenario engine logic.",
);
assert(
  !realEstateDemoSource.includes("window.setTimeout"),
  "Real estate demo must not own timer orchestration.",
);
assert(
  realEstateDemoSource.includes("Pipeline de compradores"),
  "Real estate demo must move buyers into the buyer pipeline.",
);
assert(
  realEstateDemoSource.includes("Lead calificado:"),
  "Real estate demo must show scoring feedback.",
);
assert(
  realEstateScenario.lead.classification === "hot",
  "Real estate demo must classify qualified buyers as HOT.",
);
assert(
  realEstateScenario.crmStage === "Pipeline de compradores",
  "Real estate demo must target the buyer pipeline CRM stage.",
);
assert(
  realEstateScenario.properties.length >= 3,
  "Real estate demo must include property match data.",
);

const gymDemoHtml = readText("apps/web/pages/demo/gym/index.html");
const gymDemoSource = readText("apps/web/pages/demo/gym/gym-demo.js");
const gymScenario = createDemoScenario("gym");
assert(gymDemoHtml.includes("Tarjetas de precios"), "Gym demo must expose pricing cards.");
assert(
  gymDemoHtml.includes("Simulación de chat de gimnasio"),
  "Gym demo must expose a WhatsApp-style chat simulation.",
);
assert(
  gymDemoHtml.includes("Animación de actualización de CRM"),
  "Gym demo must expose CRM update animation.",
);
assert(
  gymDemoHtml.includes("Ejecutar Demo en Vivo"),
  "Gym demo must expose a Live Demo Mode control.",
);
assert(
  gymDemoHtml.includes("Convierte preguntas por precio"),
  "Gym demo must focus on price inquiries becoming memberships.",
);
assert(
  gymDemoSource.includes("mountIndustryDemo"),
  "Gym demo must use the shared industry demo runtime.",
);
assert(gymDemoSource.includes('type: "gym"'), "Gym demo must only configure its industry type.");
assert(
  !gymDemoSource.includes("advanceScenario"),
  "Gym demo must not duplicate scenario engine logic.",
);
assert(!gymDemoSource.includes("window.setTimeout"), "Gym demo must not own timer orchestration.");
assert(
  gymDemoSource.includes("Leads interesados"),
  "Gym demo must move leads into Interested Leads.",
);
assert(
  gymDemoSource.includes("Automatización de seguimiento activada"),
  "Gym demo must trigger a follow-up automation.",
);
assert(gymDemoSource.includes("Lead calificado:"), "Gym demo must show HOT lead scoring feedback.");
assert(
  gymDemoSource.includes("Lead añadido a Leads interesados"),
  "Gym demo must show CRM movement feedback.",
);
assert(
  gymScenario.lead.message.includes("Cuánto cuesta la mensualidad") &&
    gymScenario.lead.message.includes("clase de prueba"),
  "Gym demo must start with a realistic membership price and trial inquiry.",
);
assert(
  gymScenario.lead.classification === "hot",
  "Gym demo must classify price or visit inquiries as HOT.",
);
assert(
  gymScenario.crmStage === "Leads interesados",
  "Gym demo must target the Interested Leads CRM stage.",
);
assert(
  gymScenario.automation.some((step) => step.toLowerCase().includes("seguimiento")),
  "Gym demo must include follow-up automation.",
);

const ecommerceDemoHtml = readText("apps/web/pages/demo/ecommerce/index.html");
const ecommerceDemoSource = readText("apps/web/pages/demo/ecommerce/ecommerce-demo.js");
const ecommerceScenario = createDemoScenario("ecommerce");
assert(
  ecommerceDemoHtml.includes("Simulación de chat de producto"),
  "Ecommerce demo must expose a product chat simulation.",
);
assert(
  ecommerceDemoHtml.includes("Estilo de respuesta de inventario"),
  "Ecommerce demo must expose inventory response UI.",
);
assert(
  ecommerceDemoHtml.includes("Seguimiento de conversión"),
  "Ecommerce demo must expose conversion tracking.",
);
assert(
  ecommerceDemoHtml.includes("Ejecutar Demo en Vivo"),
  "Ecommerce demo must expose a Live Demo Mode control.",
);
assert(
  ecommerceDemoHtml.includes("Recupera ventas"),
  "Ecommerce demo must focus on recovering lost sales.",
);
assert(
  ecommerceDemoSource.includes("mountIndustryDemo"),
  "Ecommerce demo must use the shared industry demo runtime.",
);
assert(
  ecommerceDemoSource.includes('type: "ecommerce"'),
  "Ecommerce demo must only configure its industry type.",
);
assert(
  !ecommerceDemoSource.includes("advanceScenario"),
  "Ecommerce demo must not duplicate scenario engine logic.",
);
assert(
  !ecommerceDemoSource.includes("window.setTimeout"),
  "Ecommerce demo must not own timer orchestration.",
);
assert(
  ecommerceDemoSource.includes("Rastreando intención de compra"),
  "Ecommerce demo must track purchase intent.",
);
assert(
  ecommerceDemoSource.includes("Pipeline de ventas"),
  "Ecommerce demo must move buyers into the sales pipeline.",
);
assert(
  ecommerceDemoSource.includes("Lead calificado:"),
  "Ecommerce demo must show HOT lead scoring feedback.",
);
assert(
  ecommerceDemoSource.includes("Automatización de conversión activada"),
  "Ecommerce demo must trigger conversion automation.",
);
assert(
  ecommerceScenario.lead.message.includes("tienes disponible este producto") &&
    ecommerceScenario.lead.message.includes("regalo"),
  "Ecommerce demo must start with a realistic product availability and urgency question.",
);
assert(
  ecommerceScenario.lead.classification === "hot",
  "Ecommerce demo must classify purchase intent as HOT.",
);
assert(
  ecommerceScenario.crmStage === "Pipeline de ventas",
  "Ecommerce demo must target the sales pipeline CRM stage.",
);
assert(
  ecommerceScenario.inventory.length >= 3,
  "Ecommerce demo must include inventory and alternative product responses.",
);
assert(
  ecommerceScenario.automation.some((step) => step.toLowerCase().includes("pipeline de ventas")),
  "Ecommerce demo must include sales pipeline automation.",
);

const agencyDemoHtml = readText("apps/web/pages/demo/agencies/index.html");
const agencyDemoSource = readText("apps/web/pages/demo/agencies/agency-demo.js");
const agencyScenario = createDemoScenario("agencies");
assert(
  agencyDemoHtml.includes("Panel multicliente"),
  "Agency demo must expose a multi-client dashboard feel.",
);
assert(agencyDemoHtml.includes("Vista de pipeline"), "Agency demo must expose a pipeline view.");
assert(
  agencyDemoHtml.includes("Disparadores de automatización"),
  "Agency demo must expose automation triggers.",
);
assert(
  agencyDemoHtml.includes("Ejecutar Demo en Vivo"),
  "Agency demo must expose a Live Demo Mode control.",
);
assert(
  agencyDemoHtml.includes("véndelo como servicio"),
  "Agency demo must focus on resale as a service.",
);
assert(
  agencyDemoSource.includes("mountIndustryDemo"),
  "Agency demo must use the shared industry demo runtime.",
);
assert(
  agencyDemoSource.includes('type: "agencies"'),
  "Agency demo must only configure its industry type.",
);
assert(
  !agencyDemoSource.includes("advanceScenario"),
  "Agency demo must not duplicate scenario engine logic.",
);
assert(
  !agencyDemoSource.includes("window.setTimeout"),
  "Agency demo must not own timer orchestration.",
);
assert(agencyDemoSource.includes("Analizando intención"), "Agency demo must show intent analysis.");
assert(
  agencyDemoSource.includes("Cliente de alto valor"),
  "Agency demo must tag the lead as a high-value client.",
);
assert(
  agencyDemoSource.includes("Pipeline de agencia"),
  "Agency demo must move the lead into the agency pipeline.",
);
assert(
  agencyDemoSource.includes("Automatización de reventa activada"),
  "Agency demo must trigger resale automation.",
);
assert(
  agencyScenario.lead.message.includes("quiero") &&
    agencyScenario.lead.message.includes("más clientes") &&
    agencyScenario.lead.message.includes("WhatsApp"),
  "Agency demo must start with a realistic client growth lead.",
);
assert(
  agencyScenario.lead.classification === "hot",
  "Agency demo must classify the qualified agency lead as HOT.",
);
assert(
  agencyScenario.crmStage === "Pipeline de agencia",
  "Agency demo must target the agency CRM pipeline stage.",
);
assert(agencyScenario.clients.length >= 3, "Agency demo must include multi-client dashboard data.");
assert(
  agencyScenario.clients.every((client) => client.name.includes("cuenta ficticia")),
  "Agency demo must label every sample account as fictional.",
);
assert(
  agencyScenario.automation.some((step) => step.toLowerCase().includes("alto valor")),
  "Agency demo must include high-value client tagging.",
);

const veterinaryDemoHtml = readText("apps/web/pages/demo/veterinary/index.html");
assert(
  veterinaryDemoHtml
    .replace(/\s+/gu, " ")
    .includes(
      "No realiza diagnóstico ni determina urgencia médica; ante síntomas preocupantes, consulta a un profesional veterinario.",
    ),
  "Veterinary demo must include the exact clinical safety disclaimer.",
);
assert(
  !/\bIA\s+(?:detect\w*|calific\w*)/iu.test(coreDemoEngineSource) &&
    !coreDemoEngineSource.includes("Detectar urgencia"),
  "Core demo scenarios must describe deterministic classification without false AI or clinical claims.",
);

console.info("Industry demo system guard passed");
