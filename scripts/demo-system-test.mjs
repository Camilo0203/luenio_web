import fs from "node:fs";
import path from "node:path";
import { createDemoScenario, demoTypes, normalizeDemoType } from "../core/demo-simulator/index.js";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

[
  "apps/web/pages/home",
  "apps/web/pages/demo/restaurants",
  "apps/web/pages/demo/real-estate",
  "apps/web/pages/demo/gym",
  "apps/web/pages/demo/ecommerce",
  "apps/web/pages/demo/agencies",
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
  assert(fs.existsSync(path.join(root, directory)), `Missing scalable SaaS directory: ${directory}`);
});

const webDemoEngineSource = readText("apps/web/src/demo-engine/index.js");
const compatibilityDemoEngineSource = readText("apps/web/demo-engine/index.js");
const industryDemoRuntimeSource = readText("apps/web/src/demo-engine/industry-demo-runtime.js");
const coreDemoEngineSource = readText("core/demo-simulator/index.js");
assert(webDemoEngineSource.includes("../../../../core/demo-simulator/index.js"), "Web src demo engine must reuse the core demo simulator.");
assert(compatibilityDemoEngineSource.includes("../src/demo-engine/index.js"), "Legacy web demo engine path must re-export the src demo engine.");
assert(industryDemoRuntimeSource.includes("mountIndustryDemo"), "Web demo engine must expose a reusable industry demo runtime.");
assert(industryDemoRuntimeSource.includes("advanceScenario"), "Industry demo runtime must drive the shared scenario engine.");
assert(industryDemoRuntimeSource.includes("createDemoScenario"), "Industry demo runtime must create scenarios from shared config.");
assert(industryDemoRuntimeSource.includes("submitPublicInquiry"), "Industry demo runtime must convert demo users through public lead capture.");
assert(industryDemoRuntimeSource.includes("demoCaptureForm"), "Industry demo runtime must render a shared lead capture form.");
assert(industryDemoRuntimeSource.includes("industry_demo_"), "Industry demo runtime must preserve industry source attribution.");
assert(industryDemoRuntimeSource.includes("autoStart"), "Industry demo runtime must auto-start demos for a live-system first impression.");
assert(coreDemoEngineSource.includes("export function createDemoScenario"), "Core demo simulator must expose createDemoScenario.");
assert(coreDemoEngineSource.includes("export function advanceScenario"), "Core demo simulator must expose advanceScenario.");
assert(coreDemoEngineSource.includes("export function normalizeDemoType"), "Core demo simulator must expose normalizeDemoType.");
assert(!coreDemoEngineSource.includes("../../apps/"), "Core demo simulator must not depend on app-layer code.");

[
  ["restaurant", "restaurants"],
  ["agency", "agencies"],
  ["real-estate", "real-estate"],
  ["gym", "gym"],
  ["ecommerce", "ecommerce"],
].forEach(([input, expected]) => {
  assert(normalizeDemoType(input) === expected, `Demo engine must normalize ${input} to ${expected}.`);
  assert(createDemoScenario(input).type === expected, `Demo scenario must accept ${input} as an engine type.`);
});

[
  "restaurants",
  "real-estate",
  "gym",
  "ecommerce",
  "agencies",
].forEach((type) => {
  assert(demoTypes.includes(type), `Demo engine must register ${type}.`);
  const scenario = createDemoScenario(type);
  assert(scenario.type === type, `Scenario type must stay ${type}.`);
  assert(scenario.steps.length === 5, `${type} demo must expose the full five-step automation loop.`);
  ["Lead received", "Analyzing intent", "Lead scored", "Sent to CRM", "Automation triggered"].forEach((stepLabel) => {
    assert(scenario.steps.some((step) => step.label.includes(stepLabel)), `${type} demo must include ${stepLabel}.`);
  });
  assert(scenario.steps.some((step) => step.label.includes("HOT 🔥")), `${type} demo must show hot scoring with visual urgency.`);

  const pagePath = `apps/web/pages/demo/${type}/index.html`;
  const html = readText(pagePath);
  assert(html.includes(`data-demo-type="${type}"`), `${pagePath} must only configure its demo type.`);
  if (type === "restaurants") {
    assert(html.includes("/apps/web/pages/demo/restaurants/restaurant-demo.js"), `${pagePath} must use the restaurant demo UI script.`);
  } else if (type === "real-estate") {
    assert(html.includes("/apps/web/pages/demo/real-estate/real-estate-demo.js"), `${pagePath} must use the real estate demo UI script.`);
  } else if (type === "gym") {
    assert(html.includes("/apps/web/pages/demo/gym/gym-demo.js"), `${pagePath} must use the gym demo UI script.`);
  } else if (type === "ecommerce") {
    assert(html.includes("/apps/web/pages/demo/ecommerce/ecommerce-demo.js"), `${pagePath} must use the ecommerce demo UI script.`);
  } else if (type === "agencies") {
    assert(html.includes("/apps/web/pages/demo/agencies/agency-demo.js"), `${pagePath} must use the agency demo UI script.`);
  } else {
    assert(html.includes("/apps/web/pages/demo/demo-page.js"), `${pagePath} must use the shared demo page script.`);
  }
  assert(!html.includes("createDemoScenario("), `${pagePath} must not inline demo logic.`);
});

const serverSource = readText("server.js");
["/demo", "/demo/restaurants", "/demo/real-estate", "/demo/gym", "/demo/ecommerce", "/demo/agencies"].forEach((route) => {
  assert(serverSource.includes(route), `Server must route ${route}.`);
});

const viteSource = readText("vite.config.js");
["demoRestaurants", "demoRealEstate", "demoGym", "demoEcommerce", "demoAgencies"].forEach((entryName) => {
  assert(viteSource.includes(entryName), `Vite build must include ${entryName}.`);
});

const landingSource = readText("apps/web/pages/home/index.html");
assert(landingSource.includes("Convierte más clientes sin responder cada mensaje manualmente."), "Landing must open with a clear trust-first value proposition.");
assert(landingSource.includes("Automatizar mi negocio"), "Landing must use the required primary CTA.");
assert(!landingSource.includes('href="/demo"'), "Trust-first landing must not route users into demo selection as the primary flow.");
assert(!landingSource.includes("live-demo-section"), "Trust-first landing must not expose fake live demo sections.");
assert(!landingSource.includes("See how many sales you're missing"), "Trust-first landing must not keep competing demo CTAs.");
const demoSelectorSource = readText("apps/web/pages/demo/index.html");
assert(demoSelectorSource.includes("Try your industry demo"), "Demo selector must clearly invite users to try an industry demo.");
assert(demoSelectorSource.includes("Descubre dónde estás perdiendo clientes hoy."), "Demo selector must frame demos around loss awareness.");
assert(demoSelectorSource.includes("Recover abandoned chats"), "Demo selector must use high-intent demo CTAs.");

const sharedDemoPageSource = readText("apps/web/pages/demo/demo-page.js");
assert(sharedDemoPageSource.includes("submitPublicInquiry"), "Interactive demos must include lead capture through the public contact API.");
assert(sharedDemoPageSource.includes("demoCaptureForm"), "Interactive demos must render a lead capture form.");
assert(sharedDemoPageSource.includes("industry_demo_"), "Demo lead capture must preserve industry source attribution.");
assert(sharedDemoPageSource.includes("../../src/demo-engine/index.js"), "Shared demo page must use the src demo engine.");

const restaurantDemoHtml = readText("apps/web/pages/demo/restaurants/index.html");
const restaurantDemoSource = readText("apps/web/pages/demo/restaurants/restaurant-demo.js");
assert(restaurantDemoHtml.includes("Chat simulation UI"), "Restaurant demo must expose a chat simulation UI.");
assert(restaurantDemoHtml.includes("CRM side panel"), "Restaurant demo must expose a CRM side panel.");
assert(restaurantDemoHtml.includes("Live Demo Mode"), "Restaurant demo must expose a Live Demo Mode indicator/control.");
assert(restaurantDemoHtml.includes("Un WhatsApp sin respuesta es un pedido que se va."), "Restaurant demo must emphasize lost WhatsApp orders.");
assert(restaurantDemoSource.includes("mountIndustryDemo"), "Restaurant demo must use the shared industry demo runtime.");
assert(restaurantDemoSource.includes('type: "restaurants"'), "Restaurant demo must only configure its industry type.");
assert(!restaurantDemoSource.includes("advanceScenario"), "Restaurant demo must not duplicate scenario engine logic.");
assert(!restaurantDemoSource.includes("window.setTimeout"), "Restaurant demo must not own timer orchestration.");
assert(restaurantDemoSource.includes("Pedido capturado"), "Restaurant demo must show captured order feedback.");
assert(restaurantDemoSource.includes("Lead scored:"), "Restaurant demo must show scoring feedback.");
assert(restaurantDemoSource.includes("Cliente movido al pipeline HOT"), "Restaurant demo must show CRM HOT pipeline movement.");

const realEstateDemoHtml = readText("apps/web/pages/demo/real-estate/index.html");
const realEstateDemoSource = readText("apps/web/pages/demo/real-estate/real-estate-demo.js");
const realEstateScenario = createDemoScenario("real-estate");
assert(realEstateDemoHtml.includes("Buyer chat simulation"), "Real estate demo must expose a buyer chat simulation.");
assert(realEstateDemoHtml.includes("Property match panel"), "Real estate demo must expose property matching.");
assert(realEstateDemoHtml.includes("CRM visualization"), "Real estate demo must expose CRM visualization.");
assert(realEstateDemoHtml.includes("Live Demo Mode"), "Real estate demo must expose a Live Demo Mode control.");
assert(realEstateDemoSource.includes("mountIndustryDemo"), "Real estate demo must use the shared industry demo runtime.");
assert(realEstateDemoSource.includes('type: "real-estate"'), "Real estate demo must only configure its industry type.");
assert(!realEstateDemoSource.includes("advanceScenario"), "Real estate demo must not duplicate scenario engine logic.");
assert(!realEstateDemoSource.includes("window.setTimeout"), "Real estate demo must not own timer orchestration.");
assert(realEstateDemoSource.includes("Buyer Pipeline"), "Real estate demo must move buyers into the buyer pipeline.");
assert(realEstateDemoSource.includes("Lead scored:"), "Real estate demo must show scoring feedback.");
assert(realEstateScenario.lead.classification === "hot", "Real estate demo must classify qualified buyers as HOT.");
assert(realEstateScenario.crmStage === "Buyer Pipeline", "Real estate demo must target the buyer pipeline CRM stage.");
assert(realEstateScenario.properties.length >= 3, "Real estate demo must include property match data.");

const gymDemoHtml = readText("apps/web/pages/demo/gym/index.html");
const gymDemoSource = readText("apps/web/pages/demo/gym/gym-demo.js");
const gymScenario = createDemoScenario("gym");
assert(gymDemoHtml.includes("Pricing cards"), "Gym demo must expose pricing cards.");
assert(gymDemoHtml.includes("Gym chat simulation"), "Gym demo must expose a WhatsApp-style chat simulation.");
assert(gymDemoHtml.includes("CRM update animation"), "Gym demo must expose CRM update animation.");
assert(gymDemoHtml.includes("Live Demo Mode"), "Gym demo must expose a Live Demo Mode control.");
assert(gymDemoHtml.includes("Convierte preguntas por precio"), "Gym demo must focus on price inquiries becoming memberships.");
assert(gymDemoSource.includes("mountIndustryDemo"), "Gym demo must use the shared industry demo runtime.");
assert(gymDemoSource.includes('type: "gym"'), "Gym demo must only configure its industry type.");
assert(!gymDemoSource.includes("advanceScenario"), "Gym demo must not duplicate scenario engine logic.");
assert(!gymDemoSource.includes("window.setTimeout"), "Gym demo must not own timer orchestration.");
assert(gymDemoSource.includes("Interested Leads"), "Gym demo must move leads into Interested Leads.");
assert(gymDemoSource.includes("Follow-up automation triggered"), "Gym demo must trigger a follow-up automation.");
assert(gymDemoSource.includes("Lead scored:"), "Gym demo must show HOT lead scoring feedback.");
assert(gymDemoSource.includes("Lead añadido a Interested Leads"), "Gym demo must show CRM movement feedback.");
assert(gymScenario.lead.message.includes("Cuánto cuesta la mensualidad") && gymScenario.lead.message.includes("clase de prueba"), "Gym demo must start with a realistic membership price and trial inquiry.");
assert(gymScenario.lead.classification === "hot", "Gym demo must classify price or visit inquiries as HOT.");
assert(gymScenario.crmStage === "Interested Leads", "Gym demo must target the Interested Leads CRM stage.");
assert(gymScenario.automation.some((step) => step.toLowerCase().includes("follow-up")), "Gym demo must include follow-up automation.");

const ecommerceDemoHtml = readText("apps/web/pages/demo/ecommerce/index.html");
const ecommerceDemoSource = readText("apps/web/pages/demo/ecommerce/ecommerce-demo.js");
const ecommerceScenario = createDemoScenario("ecommerce");
assert(ecommerceDemoHtml.includes("Product chat simulation"), "Ecommerce demo must expose a product chat simulation.");
assert(ecommerceDemoHtml.includes("Inventory response style"), "Ecommerce demo must expose inventory response UI.");
assert(ecommerceDemoHtml.includes("Conversion tracking"), "Ecommerce demo must expose conversion tracking.");
assert(ecommerceDemoHtml.includes("Live Demo Mode"), "Ecommerce demo must expose a Live Demo Mode control.");
assert(ecommerceDemoHtml.includes("Recupera ventas"), "Ecommerce demo must focus on recovering lost sales.");
assert(ecommerceDemoSource.includes("mountIndustryDemo"), "Ecommerce demo must use the shared industry demo runtime.");
assert(ecommerceDemoSource.includes('type: "ecommerce"'), "Ecommerce demo must only configure its industry type.");
assert(!ecommerceDemoSource.includes("advanceScenario"), "Ecommerce demo must not duplicate scenario engine logic.");
assert(!ecommerceDemoSource.includes("window.setTimeout"), "Ecommerce demo must not own timer orchestration.");
assert(ecommerceDemoSource.includes("Tracking purchase intent"), "Ecommerce demo must track purchase intent.");
assert(ecommerceDemoSource.includes("Sales Pipeline"), "Ecommerce demo must move buyers into the sales pipeline.");
assert(ecommerceDemoSource.includes("Lead scored:"), "Ecommerce demo must show HOT lead scoring feedback.");
assert(ecommerceDemoSource.includes("Conversion automation triggered"), "Ecommerce demo must trigger conversion automation.");
assert(ecommerceScenario.lead.message.includes("tienes disponible este producto") && ecommerceScenario.lead.message.includes("regalo"), "Ecommerce demo must start with a realistic product availability and urgency question.");
assert(ecommerceScenario.lead.classification === "hot", "Ecommerce demo must classify purchase intent as HOT.");
assert(ecommerceScenario.crmStage === "Sales Pipeline", "Ecommerce demo must target the sales pipeline CRM stage.");
assert(ecommerceScenario.inventory.length >= 3, "Ecommerce demo must include inventory and alternative product responses.");
assert(ecommerceScenario.automation.some((step) => step.toLowerCase().includes("sales pipeline")), "Ecommerce demo must include sales pipeline automation.");

const agencyDemoHtml = readText("apps/web/pages/demo/agencies/index.html");
const agencyDemoSource = readText("apps/web/pages/demo/agencies/agency-demo.js");
const agencyScenario = createDemoScenario("agencies");
assert(agencyDemoHtml.includes("Multi-client dashboard feel"), "Agency demo must expose a multi-client dashboard feel.");
assert(agencyDemoHtml.includes("Pipeline view"), "Agency demo must expose a pipeline view.");
assert(agencyDemoHtml.includes("Automation triggers"), "Agency demo must expose automation triggers.");
assert(agencyDemoHtml.includes("Live Demo Mode"), "Agency demo must expose a Live Demo Mode control.");
assert(agencyDemoHtml.includes("véndelo como servicio"), "Agency demo must focus on resale as a service.");
assert(agencyDemoSource.includes("mountIndustryDemo"), "Agency demo must use the shared industry demo runtime.");
assert(agencyDemoSource.includes('type: "agencies"'), "Agency demo must only configure its industry type.");
assert(!agencyDemoSource.includes("advanceScenario"), "Agency demo must not duplicate scenario engine logic.");
assert(!agencyDemoSource.includes("window.setTimeout"), "Agency demo must not own timer orchestration.");
assert(agencyDemoSource.includes("Analyzing intent"), "Agency demo must show intent analysis.");
assert(agencyDemoSource.includes("High-value client"), "Agency demo must tag the lead as a high-value client.");
assert(agencyDemoSource.includes("Agency Pipeline"), "Agency demo must move the lead into the agency pipeline.");
assert(agencyDemoSource.includes("Resell automation triggered"), "Agency demo must trigger resale automation.");
assert(agencyScenario.lead.message.includes("quiero") && agencyScenario.lead.message.includes("más clientes") && agencyScenario.lead.message.includes("WhatsApp"), "Agency demo must start with a realistic client growth lead.");
assert(agencyScenario.lead.classification === "hot", "Agency demo must classify the qualified agency lead as HOT.");
assert(agencyScenario.crmStage === "Agency Pipeline", "Agency demo must target the agency CRM pipeline stage.");
assert(agencyScenario.clients.length >= 3, "Agency demo must include multi-client dashboard data.");
assert(agencyScenario.automation.some((step) => step.toLowerCase().includes("high-value")), "Agency demo must include high-value client tagging.");

console.info("Industry demo system guard passed");
