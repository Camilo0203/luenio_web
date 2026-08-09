import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function listFiles(directory) {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(relativePath);
    return relativePath;
  });
}

/** Concat of all admin frontend modules (admin.js is modularized across apps/admin/src). */
function readAdminSource() {
  return listFiles("apps/admin/src")
    .filter((filePath) => filePath.endsWith(".js"))
    .map((filePath) => readText(filePath))
    .join("\n");
}

const landingHtml = readText("apps/web/pages/home/index.html");
const landingCss = readText("apps/web/src/public-site.css");
const landingJs = readText("apps/web/src/public-site.js");
const brandConfig = readText("apps/web/src/brand-config.js");
const pricingHtml = readText("apps/web/pages/pricing/index.html");
const termsHtml = readText("apps/web/pages/legal/terminos/index.html");
const privacyHtml = readText("apps/web/pages/legal/privacidad/index.html");
const refundsHtml = readText("apps/web/pages/legal/reembolsos/index.html");
const robotsTxt = readText("public/robots.txt");
const sitemapXml = readText("public/sitemap.xml");
const adminHtml = readText("apps/admin/admin.html");
const adminJs = readAdminSource();
const adminCss = readText("apps/admin/src/admin.css");
const authHtml = readText("apps/admin/auth.html");
const crmAppJs = readText("apps/admin/crm/app.js");
const crmShellJs = readText("components/layout/Shell.js");
const crmSidebarJs = readText("components/layout/Sidebar.js");
const simulationCss = readText("apps/web/src/industry-simulations.css");
const industryDemoCss = readText("apps/web/src/industry-demos.css");
const homeClarityCss = readText("apps/web/src/home-clarity.css");

[
  [
    "combined service offer",
    landingHtml.includes("Páginas web") && landingHtml.includes("Automatizaciones"),
  ],
  [
    "honest public proof",
    !landingHtml.includes("testimonial-grid") &&
      !landingHtml.includes("Laura Méndez") &&
      !landingHtml.includes("+30%") &&
      landingHtml.includes("ficticias") &&
      landingHtml.includes("No representan clientes reales"),
  ],
  [
    "demonstrative cases",
    ["Titan Fitness", "Sabor y Fuego", "Hogar Prime", "NovaStore", "Impulso Digital"].every(
      (name) => landingHtml.includes(name),
    ) &&
      ["/gimnasios", "/restaurantes", "/inmobiliarias", "/tiendas-online", "/agencias"].every(
        (route) => landingHtml.includes(`href="${route}"`),
      ),
  ],
  ["landing conversion CTA", landingHtml.includes("Cotizar por WhatsApp")],
  [
    "landing value proposition",
    landingHtml.includes("Tu próxima solución digital") && landingHtml.includes("funcionando."),
  ],
  [
    "production contact data",
    landingHtml.includes("contacto@luenio.com") && landingHtml.includes("Colombia"),
  ],
  [
    "lead-gen quote model",
    pricingHtml.includes("100% personalizado") &&
      pricingHtml.includes("Diagnóstico 100% gratuito") &&
      !pricingHtml.includes("Desde 500 USD") &&
      !pricingHtml.includes("pricing-price"),
  ],
  [
    "WhatsApp and form conversion",
    landingJs.includes("whatsapp_open") &&
      landingJs.includes("whatsapp_submit") &&
      landingJs.includes("generate_lead") &&
      brandConfig.includes('["57", "319", "320", "3702"]'),
  ],
  [
    "legal pages production copy",
    !/\[[^\]]+\]/.test(`${termsHtml}\n${privacyHtml}\n${refundsHtml}`) &&
      termsHtml.includes("10 de julio de 2026") &&
      privacyHtml.includes("10 de julio de 2026") &&
      refundsHtml.includes("10 de julio de 2026") &&
      termsHtml.includes("landing pages") &&
      privacyHtml.includes("contacto@luenio.com"),
  ],
  [
    "search index boundaries",
    robotsTxt.includes("Disallow: /demo") &&
      robotsTxt.includes("Disallow: /gym") &&
      sitemapXml.includes("https://luenio.com/") &&
      sitemapXml.includes("https://luenio.com/cotizacion") &&
      !sitemapXml.includes("/demo"),
  ],
  [
    "domain and social metadata",
    landingHtml.includes('rel="canonical" href="https://luenio.com/"') &&
      landingHtml.includes("https://luenio.com/og-luenio.png"),
  ],
  [
    "landing premium polish",
    landingCss.includes(".product-scene") &&
      landingCss.includes(".wa-widget") &&
      landingCss.includes("prefers-reduced-motion"),
  ],
].forEach(([label, passed]) => {
  assert(passed, `Sellable landing must preserve ${label}.`);
});

assert(!/min\(100%\s*-/.test(landingCss), "Public responsive widths must use valid calc().");
assert(
  landingCss.includes("@media (max-width: 900px)"),
  "Tablet navigation breakpoint is required.",
);
assert(landingCss.includes("100dvh"), "Public modal must support dynamic mobile viewports.");
assert(landingCss.includes("safe-area-inset-bottom"), "Public CTAs must respect safe areas.");

[
  [
    "Live Demo Mode button",
    adminHtml.includes('id="startLiveDemo"') && adminHtml.includes("Ejecutar Demo en Vivo"),
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
  [
    "actions history",
    adminCss.includes(".actions-history") && adminJs.includes("Historial de acciones"),
  ],
  [
    "lead search and CSV export",
    adminHtml.includes('id="leadSearch"') &&
      adminHtml.includes('id="exportLeadsCsv"') &&
      adminJs.includes("exportLeadsCsv") &&
      adminCss.includes(".admin-search-export"),
  ],
  [
    "lead notes and tags editor",
    adminJs.includes("leadMetadataForm") &&
      adminJs.includes("Guardar notas y etiquetas") &&
      adminCss.includes(".lead-metadata-form"),
  ],
  [
    "work queue and smart filters",
    adminHtml.includes('id="workQueue"') &&
      adminHtml.includes('data-smart-filter="stale_hot"') &&
      adminJs.includes("buildWorkQueue") &&
      adminCss.includes(".work-queue-panel"),
  ],
  [
    "next action and contact log",
    adminJs.includes("leadNextActionForm") &&
      adminJs.includes("leadContactLogForm") &&
      adminJs.includes("logContact"),
  ],
  [
    "whatsapp reply templates",
    adminJs.includes("getReplyTemplate") && adminJs.includes("Copiar mensaje WhatsApp"),
  ],
  [
    "onboarding banner progress",
    adminHtml.includes('id="onboardingBanner"') && adminJs.includes("markOnboardingStep"),
  ],
  ["digest preview", adminHtml.includes('id="previewDigest"') && adminJs.includes("previewDigest")],
  [
    "bulk and import tools",
    adminHtml.includes('id="bulkActionsBar"') &&
      adminHtml.includes('id="importLeadsCsv"') &&
      adminJs.includes("bulkUpdateLeads") &&
      adminJs.includes("parseCrmCsv"),
  ],
  [
    "email reply templates",
    adminJs.includes("getEmailTemplate") && adminJs.includes("data-copy-email"),
  ],
  [
    "crm reports panel",
    adminHtml.includes('id="reports"') &&
      adminHtml.includes('id="reportSources"') &&
      adminJs.includes("buildCrmReports") &&
      adminJs.includes("renderReports"),
  ],
  [
    "lead assignment",
    adminHtml.includes('data-smart-filter="mine"') &&
      adminJs.includes("assigneeUserId") &&
      adminJs.includes("leadAssigneeForm") &&
      adminJs.includes("populateAssigneeSelects"),
  ],
].forEach(([label, passed]) => {
  assert(passed, `Sellable dashboard must preserve ${label}.`);
});

[
  "Lead recibido...",
  "Analizando intención...",
  "Lead calificado: CALIENTE / TIBIO / FRÍO",
  "Enviado al CRM",
  "Automatización activada",
].forEach((systemState) => {
  assert(adminJs.includes(systemState), `Live demo must show system state: ${systemState}`);
});

[
  'classification: "hot"',
  'classification: "warm"',
  'classification: "cold"',
  "classificationLabel(activeLead.classification)",
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

assert(
  authHtml.indexOf('class="auth-side"') < authHtml.indexOf('class="auth-panel auth-panel--main"') &&
    adminCss.includes(".auth-panel--main {\n    order: -1;"),
  "Mobile login must place the credential form before supporting security content.",
);
assert(
  crmShellJs.includes("@media (max-width: 640px)") &&
    crmShellJs.includes(".crm-sidebar {\n    width: 100%;\n    min-height: auto;") &&
    crmSidebarJs.includes("min-height: 100vh"),
  "CRM mobile shell must override the desktop sidebar height and width.",
);
assert(
  crmAppJs.includes("friendlyCrmError") &&
    crmAppJs.includes("No pudimos conectar con tus datos") &&
    !crmAppJs.includes("description: msg"),
  "CRM errors must remain actionable without exposing backend details.",
);
assert(
  simulationCss.includes("body.simulation-page .demo-nav a {\n    min-height: 44px;") &&
    industryDemoCss.includes(".demo-choice {\n  min-height: 44px;") &&
    homeClarityCss.includes(".hc-demo-switcher button {\n  min-height: 44px;"),
  "Primary mobile demo controls must preserve 44px touch targets.",
);

console.info("Sellable SaaS product guard passed");
