import fs from "node:fs";
import path from "node:path";

const previousContactWebhookUrl = process.env.CONTACT_WEBHOOK_URL;
const previousContactWebhookToken = process.env.CONTACT_WEBHOOK_TOKEN;
const previousFetch = globalThis.fetch;
const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;

process.env.CONTACT_WEBHOOK_URL = "https://internal.example/webhook/contact";
process.env.CONTACT_WEBHOOK_TOKEN = "test-webhook-bearer";

const { default: contactHandler } = await import("../api/contact.js");
const { deliverQueuedContactInquiries } = await import("../api/services/contact-service.js");
const { getContactDeliveryHealth, readLocalState, writeLocalState } =
  await import("../db/storage.js");
const { PublicInquirySecurityError, validatePublicInquirySecurity } =
  await import("../api/services/turnstile-service.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

try {
  const securityConfig = {
    required: true,
    siteKey: "site-key",
    secretKey: "secret-key",
    allowedHostnames: ["luenio.com"],
  };
  const validBody = {
    turnstileToken: "valid-token",
    website: "",
    formStartedAt: new Date(Date.now() - 5_000).toISOString(),
  };
  const validSecurity = await validatePublicInquirySecurity({
    body: validBody,
    config: securityConfig,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, hostname: "luenio.com", action: "contact" }),
    }),
  });
  assert(validSecurity.valid, "A valid Turnstile contact token must pass.");

  const rejectionCases = [
    ["missing", { ...validBody, turnstileToken: "" }, null],
    ["honeypot", { ...validBody, website: "spam.example" }, null],
    [
      "expired or reused",
      validBody,
      {
        success: false,
        hostname: "luenio.com",
        action: "contact",
        "error-codes": ["timeout-or-duplicate"],
      },
    ],
    ["wrong hostname", validBody, { success: true, hostname: "evil.example", action: "contact" }],
    ["wrong action", validBody, { success: true, hostname: "luenio.com", action: "login" }],
  ];
  for (const [label, body, result] of rejectionCases) {
    let rejected = false;
    try {
      await validatePublicInquirySecurity({
        body,
        config: securityConfig,
        fetchImpl: async () => ({ ok: true, json: async () => result }),
      });
    } catch (error) {
      rejected = error instanceof PublicInquirySecurityError;
    }
    assert(rejected, `Turnstile must reject ${label}.`);
  }

  let unavailableRejected = false;
  try {
    await validatePublicInquirySecurity({
      body: validBody,
      config: securityConfig,
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
    });
  } catch (error) {
    unavailableRejected = error instanceof PublicInquirySecurityError && error.statusCode === 503;
  }
  assert(unavailableRejected, "Turnstile must fail closed when Siteverify is unavailable.");

  let deliveredTo = null;
  let deliveredAuthorization = null;
  globalThis.fetch = async (url, options) => {
    deliveredTo = url;
    deliveredAuthorization = options?.headers?.Authorization;
    return {
      ok: false,
      status: 502,
    };
  };

  const response = createMockResponse();
  await contactHandler(
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        name: "Webhook Privacy Lead",
        business: "Webhook Privacy Business",
        phone: "+573001112222",
        service: "Automatización de WhatsApp",
        message: "Quiero automatizar seguimiento comercial.",
        source: "privacy_guard",
        website: "",
        formStartedAt: new Date(Date.now() - 5_000).toISOString(),
      },
    },
    response,
  );

  assert(
    response.statusCode === 200,
    `Public contact handler should accept valid inquiry, got ${response.statusCode}.`,
  );
  assert(
    deliveredTo === process.env.CONTACT_WEBHOOK_URL,
    "Configured contact webhook should still be invoked internally.",
  );
  assert(
    deliveredAuthorization === "Bearer test-webhook-bearer",
    "Contact webhook must include its configured bearer token.",
  );
  assert(
    response.body.ok === true && response.body.inquiryId,
    "Public response must confirm capture.",
  );
  assert(!("storage" in response.body), "Public response must not expose storage infrastructure.");
  assert(!("webhook" in response.body), "Public response must not expose delivery infrastructure.");

  const queuedDatabase = readLocalState();
  const queuedDelivery = (queuedDatabase.contactDeliveries || []).find(
    (delivery) => delivery.inquiryId === response.body.inquiryId,
  );
  assert(
    queuedDelivery?.status === "retry" && queuedDelivery.attempts === 1,
    "A failed notification must remain in the persistent retry queue.",
  );
  writeLocalState({
    ...queuedDatabase,
    contactDeliveries: queuedDatabase.contactDeliveries.map((delivery) =>
      delivery.id === queuedDelivery.id
        ? { ...delivery, nextAttemptAt: new Date(Date.now() - 1_000).toISOString() }
        : delivery,
    ),
  });
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  const retryResults = await deliverQueuedContactInquiries({ limit: 10 });
  assert(
    retryResults.some(
      (result) => result.deliveryId === queuedDelivery.id && result.status === "sent",
    ),
    "A recovered webhook must deliver the queued notification.",
  );
  const deliveredRecord = (readLocalState().contactDeliveries || []).find(
    (delivery) => delivery.id === queuedDelivery.id,
  );
  assert(
    deliveredRecord?.status === "sent" && deliveredRecord.attempts === 2,
    "A successful retry must persist terminal delivery state.",
  );
  const deliveredHealth = await getContactDeliveryHealth();
  assert(deliveredHealth.healthy, "A completed delivery queue must remain healthy.");
  const deliveredDatabase = readLocalState();
  writeLocalState({
    ...deliveredDatabase,
    contactDeliveries: [
      {
        ...deliveredRecord,
        id: "delivery_dead_health_test",
        inquiryId: "inquiry_dead_health_test",
        status: "dead",
      },
      ...(deliveredDatabase.contactDeliveries || []),
    ],
  });
  const degradedHealth = await getContactDeliveryHealth();
  assert(
    degradedHealth.healthy === false && degradedHealth.dead === 1,
    "A dead delivery must degrade protected health checks.",
  );

  console.info("Contact public response guard passed");
} finally {
  if (previousContactWebhookUrl === undefined) delete process.env.CONTACT_WEBHOOK_URL;
  else process.env.CONTACT_WEBHOOK_URL = previousContactWebhookUrl;
  if (previousContactWebhookToken === undefined) delete process.env.CONTACT_WEBHOOK_TOKEN;
  else process.env.CONTACT_WEBHOOK_TOKEN = previousContactWebhookToken;

  globalThis.fetch = previousFetch;

  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
