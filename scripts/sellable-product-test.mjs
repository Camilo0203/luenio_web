import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

const landingHtml = readText("apps/web/pages/home/index.html");
const landingCss = readText("apps/web/src/style.css");
const adminHtml = readText("apps/admin/admin.html");
const adminJs = readText("apps/admin/src/admin.js");
const adminCss = readText("apps/admin/src/admin.css");

[
  [
    "landing trust metrics",
    landingHtml.includes("proof-section") && landingHtml.includes("proof-grid"),
  ],
  [
    "landing testimonials",
    landingHtml.includes("testimonial-grid") && landingHtml.includes("Laura"),
  ],
  [
    "landing use cases",
    landingHtml.includes("Ecommerce") &&
      landingHtml.includes("Inmobiliaria") &&
      landingHtml.includes("Educación"),
  ],
  ["landing conversion CTA", landingHtml.includes("Automatizar mi negocio")],
  [
    "landing trust-first headline",
    landingHtml.includes("Convierte más clientes sin responder cada mensaje manualmente."),
  ],
  [
    "landing single CTA language",
    !landingHtml.includes("See how many sales you're missing") &&
      !landingHtml.includes("Fix my missed leads"),
  ],
  [
    "landing no fake demo focus",
    !landingHtml.includes("live-demo-section") && !landingHtml.includes('href="/demo"'),
  ],
  [
    "landing proof styles",
    landingCss.includes(".proof-grid") && landingCss.includes(".testimonial-grid"),
  ],
  [
    "landing premium polish",
    landingCss.includes("@keyframes heroIntro") && landingCss.includes(".trust-signals"),
  ],
].forEach(([label, passed]) => {
  assert(passed, `Sellable landing must preserve ${label}.`);
});

[
  [
    "Live Demo Mode button",
    adminHtml.includes('id="startLiveDemo"') && adminHtml.includes("Live Demo Mode"),
  ],
  [
    "visible system states container",
    adminHtml.includes('id="systemSteps"') && adminCss.includes(".system-steps"),
  ],
  [
    "onboarding flow",
    adminHtml.includes('id="onboardingFlow"') && adminCss.includes(".onboarding-flow"),
  ],
  ["lead table", adminHtml.includes('id="leadTable"') && adminCss.includes(".lead-table-row")],
  [
    "pipeline kanban",
    adminHtml.includes('id="pipelineBoard"') && adminCss.includes(".pipeline-column"),
  ],
  ["lead detail panel", adminHtml.includes('id="leadDetail"') && adminCss.includes(".lead-detail")],
  ["actions history", adminCss.includes(".actions-history") && adminJs.includes("Actions history")],
].forEach(([label, passed]) => {
  assert(passed, `Sellable dashboard must preserve ${label}.`);
});

[
  "Lead received...",
  "Analyzing intent...",
  "Lead scored: HOT / WARM / COLD",
  "Sent to CRM",
  "Automation triggered",
].forEach((systemState) => {
  assert(adminJs.includes(systemState), `Live demo must show system state: ${systemState}`);
});

[
  'classification: "hot"',
  'classification: "warm"',
  'classification: "cold"',
  "activeLead.classification.toUpperCase()",
].forEach((scoringSignal) => {
  assert(
    adminJs.includes(scoringSignal),
    `Live demo must support dynamic scoring signal: ${scoringSignal}`,
  );
});

[
  "message.received",
  "intent.classified",
  "crm.updated",
  "followup.triggered",
  "automation.triggered",
].forEach((eventType) => {
  assert(adminJs.includes(eventType), `Live demo must emit visible event: ${eventType}`);
});

[
  "createDemoLead",
  "runLiveDemo",
  "renderLeadTable",
  "renderOnboarding",
  "renderSystemSteps",
  "state.demoLeads",
  "state.demoEvents",
].forEach((implementationHook) => {
  assert(
    adminJs.includes(implementationHook),
    `Sellable product UI must keep implementation hook: ${implementationHook}`,
  );
});

["score-hot", "score-warm", "score-cold"].forEach((scoreClass) => {
  assert(
    adminCss.includes(scoreClass),
    `CRM must preserve score visualization class: ${scoreClass}`,
  );
});

assert(
  !adminJs.includes('localStorage.setItem("luenio.demo'),
  "Live Demo Mode must not persist fake demo leads as customer data.",
);
assert(
  !adminJs.includes("await updatePipeline({ leadId: lead.id") ||
    adminJs.includes("if (isDemoLead(lead.id))"),
  "Demo leads must not call production pipeline updates.",
);

console.info("Sellable SaaS product guard passed");
