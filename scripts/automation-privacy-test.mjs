const envKeys = [
  "LUENIO_WEBHOOK_URL",
  "LUENIO_CRM_WEBHOOK_URL",
  "LUENIO_WHATSAPP_WEBHOOK_URL",
  "LUENIO_EMAIL_WEBHOOK_URL",
  "AUTOMATION_WEBHOOK_TOKEN",
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;

process.env.LUENIO_WEBHOOK_URL = "https://internal.example/webhook/main";
process.env.LUENIO_CRM_WEBHOOK_URL = "https://internal.example/webhook/crm";
process.env.LUENIO_WHATSAPP_WEBHOOK_URL = "https://internal.example/webhook/whatsapp";
process.env.LUENIO_EMAIL_WEBHOOK_URL = "https://internal.example/webhook/email";
process.env.AUTOMATION_WEBHOOK_TOKEN = "automation-test-token";

const { normalizeLead } = await import("../core/engine.js");
const { runAutomationEngine } = await import("../api/services/automation-service.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const deliveredUrls = [];
  const deliveredAuthorizations = [];
  globalThis.fetch = async (url, options) => {
    deliveredUrls.push(url);
    deliveredAuthorizations.push(options?.headers?.Authorization);
    return {
      ok: false,
      status: 502,
    };
  };

  const lead = normalizeLead({
    name: "Automation Privacy",
    business: "Automation Privacy Business",
    phone: "+573001112233",
    service: "Automatización de WhatsApp",
    message: "Quiero automatizar mis ventas, necesito cotizacion y precio para empezar ahora.",
    source: "automation_privacy_test",
  });

  const actionLog = await runAutomationEngine(lead, { plan: "pro" });
  assert(
    deliveredUrls.includes(process.env.LUENIO_WEBHOOK_URL),
    "Configured webhook must be invoked internally.",
  );
  assert(
    deliveredAuthorizations.every((value) => value === "Bearer automation-test-token"),
    "Every automation delivery must use its configured bearer token.",
  );
  assert(
    deliveredUrls.includes(process.env.LUENIO_CRM_WEBHOOK_URL),
    "Configured CRM webhook must be invoked internally.",
  );
  assert(
    actionLog.integrationResults.length >= 2,
    "Automation should record integration delivery results.",
  );

  actionLog.integrationResults.forEach((result) => {
    assert(result.label, "Integration result must include a label.");
    assert(result.status, "Integration result must include status.");
    assert(
      !("destination" in result),
      "Integration result must not expose internal destination URLs.",
    );
    assert(!("error" in result), "Integration result must not expose raw provider errors.");
  });

  console.info("Automation privacy guard passed");
} finally {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
  globalThis.fetch = previousFetch;
}
