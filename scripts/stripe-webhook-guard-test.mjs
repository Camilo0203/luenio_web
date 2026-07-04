const previousNodeEnv = process.env.NODE_ENV;
const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
import crypto from "node:crypto";

process.env.NODE_ENV = "production";
delete process.env.STRIPE_WEBHOOK_SECRET;

const { default: stripeWebhookHandler } = await import("../api/stripe-webhook.js");

function stripeSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
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

const response = createMockResponse();
await stripeWebhookHandler({
  method: "POST",
  headers: { "stripe-signature": "t=123,v1=bad" },
  rawBody: JSON.stringify({ id: "evt_missing_secret", type: "checkout.session.completed" }),
}, response);

if (response.statusCode !== 503) {
  throw new Error(`Expected 503 without STRIPE_WEBHOOK_SECRET in production, got ${response.statusCode}.`);
}

if (response.body?.error !== "STRIPE_WEBHOOK_SECRET is not configured.") {
  throw new Error(`Unexpected webhook error: ${JSON.stringify(response.body)}.`);
}

process.env.STRIPE_WEBHOOK_SECRET = "whsec_luenio_local_test_secret";

const replayedRawBody = JSON.stringify({ id: "evt_replayed", type: "customer.subscription.updated" });
const replayedResponse = createMockResponse();
await stripeWebhookHandler({
  method: "POST",
  headers: {
    "stripe-signature": stripeSignature(
      replayedRawBody,
      process.env.STRIPE_WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000) - 3600
    ),
  },
  rawBody: replayedRawBody,
}, replayedResponse);

if (replayedResponse.statusCode !== 400) {
  throw new Error(`Expected old Stripe signatures to be rejected with 400, got ${replayedResponse.statusCode}.`);
}

const invalidPayload = "{not-json";
const invalidPayloadResponse = createMockResponse();
await stripeWebhookHandler({
  method: "POST",
  headers: { "stripe-signature": stripeSignature(invalidPayload, process.env.STRIPE_WEBHOOK_SECRET) },
  rawBody: invalidPayload,
}, invalidPayloadResponse);

if (invalidPayloadResponse.statusCode !== 400 || invalidPayloadResponse.body?.error !== "Invalid Stripe webhook payload.") {
  throw new Error(`Expected invalid Stripe JSON payload to return 400, got ${JSON.stringify(invalidPayloadResponse.body)}.`);
}

const currentRawBody = JSON.stringify({ id: "evt_current", type: "customer.subscription.updated", data: { object: { metadata: {} } } });
const currentResponse = createMockResponse();
await stripeWebhookHandler({
  method: "POST",
  headers: { "stripe-signature": stripeSignature(currentRawBody, process.env.STRIPE_WEBHOOK_SECRET) },
  rawBody: currentRawBody,
}, currentResponse);

if (currentResponse.statusCode !== 200 || currentResponse.body?.received !== true) {
  throw new Error(`Expected current signed Stripe webhook to be accepted, got ${JSON.stringify(currentResponse.body)}.`);
}

if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;

if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;

console.info("Stripe webhook production guard passed");
