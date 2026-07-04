import crypto from "node:crypto";
import { plans } from "../../config/billing.js";
import { getStripeEnv, isProduction } from "../../config/env.js";
import { buildSubscriptionUpdatedEvent } from "../../core/events.js";
import { updateUserSubscription } from "../../db/storage.js";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export class StripeWebhookError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "StripeWebhookError";
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

function getWebhookSecret() {
  const secret =
    getStripeEnv().webhookSecret || (isProduction() ? "" : "whsec_luenio_local_test_secret");

  if (!secret) {
    throw new StripeWebhookError("STRIPE_WEBHOOK_SECRET is not configured.", 503);
  }

  return secret;
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!rawBody || !signatureHeader || !secret) return false;

  const signatureParts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  const timestamp = signatureParts.t;
  const signature = signatureParts.v1;
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");

  const received = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(received, expected);
}

function parseSignedStripeEvent({ rawBody, signature }) {
  const secret = getWebhookSecret();

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    throw new StripeWebhookError("Invalid Stripe signature.", 400);
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new StripeWebhookError("Invalid Stripe webhook payload.", 400);
  }
}

function timestampToIso(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function normalizePlan(plan) {
  return plans[plan] ? plan : "starter";
}

function buildSubscriptionUpdate({
  userId,
  plan,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
}) {
  const subscription = {
    id: stripeSubscriptionId || `subscription_${userId}`,
    userId,
    plan,
    status,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
    updatedAt: new Date().toISOString(),
  };

  return {
    subscription,
    event: buildSubscriptionUpdatedEvent({ userId, subscription }),
  };
}

async function handleSubscriptionObject(subscription = {}) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return { ignored: true, reason: "Missing user_id metadata" };

  const plan = normalizePlan(subscription.metadata?.plan);
  const update = buildSubscriptionUpdate({
    userId,
    plan,
    status: subscription.status || "unknown",
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: timestampToIso(subscription.current_period_end),
  });

  return updateUserSubscription(update.subscription, update.event);
}

async function handleCheckoutSession(session = {}) {
  const userId = session.metadata?.user_id || session.client_reference_id;
  if (!userId) return { ignored: true, reason: "Missing user_id metadata" };

  const plan = normalizePlan(session.metadata?.plan);
  const update = buildSubscriptionUpdate({
    userId,
    plan,
    status: session.payment_status === "paid" ? "active" : session.status || "open",
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    currentPeriodEnd: null,
  });

  return updateUserSubscription(update.subscription, update.event);
}

async function dispatchStripeEvent(event) {
  const object = event.data?.object;

  if (event.type === "checkout.session.completed") {
    return handleCheckoutSession(object);
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return handleSubscriptionObject(object);
  }

  return { ignored: true, reason: `Unhandled event ${event.type}` };
}

export async function processStripeWebhook({ rawBody, signature }) {
  const event = parseSignedStripeEvent({ rawBody, signature });
  const result = await dispatchStripeEvent(event);

  return {
    ok: true,
    received: true,
    type: event.type,
    result,
  };
}
