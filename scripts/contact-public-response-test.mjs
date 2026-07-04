import fs from "node:fs";
import path from "node:path";

const previousContactWebhookUrl = process.env.CONTACT_WEBHOOK_URL;
const previousFetch = globalThis.fetch;
const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;

process.env.CONTACT_WEBHOOK_URL = "https://internal.example/webhook/contact";

const { default: contactHandler } = await import("../api/contact.js");

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
  let deliveredTo = null;
  globalThis.fetch = async (url) => {
    deliveredTo = url;
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
    response.body.webhook?.status === "failed",
    "Public response should report sanitized webhook status.",
  );
  assert(
    response.body.webhook?.httpStatus === 502,
    "Public response may expose HTTP status without internal destination.",
  );
  assert(
    !("destination" in response.body.webhook),
    "Public response must not expose contact webhook destination.",
  );
  assert(
    !("error" in response.body.webhook),
    "Public response must not expose contact webhook error details.",
  );

  console.info("Contact public response guard passed");
} finally {
  if (previousContactWebhookUrl === undefined) delete process.env.CONTACT_WEBHOOK_URL;
  else process.env.CONTACT_WEBHOOK_URL = previousContactWebhookUrl;

  globalThis.fetch = previousFetch;

  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
