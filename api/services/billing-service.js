import { getLeadUsage, getPlan, plans } from "../../config/billing.js";
import { getEnv, getStripeEnv, isProduction } from "../../config/env.js";
import { listCrmData } from "../../db/storage.js";

export function isStripeCheckoutConfigured() {
  return Boolean(getStripeEnv().secretKey);
}

export async function getBillingOverview(user) {
  const crmData = await listCrmData(user.id);
  return {
    currentPlan: user.plan,
    usage: getLeadUsage(user, crmData.leads || []),
    plans,
    stripeConfigured: isStripeCheckoutConfigured(),
  };
}

export function getBaseUrl(request) {
  const configuredAppUrl = getEnv("APP_URL");
  if (isProduction()) {
    if (!configuredAppUrl) {
      const error = new Error("APP_URL is required for Stripe checkout in production.");
      error.statusCode = 503;
      throw error;
    }

    try {
      const appUrl = new URL(configuredAppUrl);
      if (appUrl.protocol !== "https:") throw new Error("APP_URL must use HTTPS in production.");
      return appUrl.origin;
    } catch (error) {
      const appUrlError = new Error(error.message || "APP_URL must be a valid HTTPS origin.");
      appUrlError.statusCode = 503;
      throw appUrlError;
    }
  }

  const host = request.headers?.host || "127.0.0.1:4180";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return configuredAppUrl || `${protocol}://${host}`;
}

export async function createStripeCheckout({ user, planId, request }) {
  const stripe = getStripeEnv();
  const secretKey = stripe.secretKey;
  if (!secretKey) {
    const error = new Error("STRIPE_SECRET_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const plan = getPlan(planId);
  const priceId = getEnv(plan.stripePriceEnv);
  if (!priceId) {
    const error = new Error(`${plan.stripePriceEnv} is not configured.`);
    error.statusCode = 503;
    throw error;
  }

  const baseUrl = getBaseUrl(request);
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/dashboard?billing=cancelled`,
    client_reference_id: user.id,
    customer_email: user.email,
    "metadata[user_id]": user.id,
    "metadata[plan]": planId,
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][plan]": planId,
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const body = await stripeResponse.json();
  if (!stripeResponse.ok) {
    const error = new Error(body.error?.message || "Stripe checkout failed.");
    error.statusCode = stripeResponse.status;
    throw error;
  }

  return body;
}

export async function createBillingCheckout({ user, planId = "starter", request }) {
  if (!plans[planId]) {
    const error = new Error("Unknown plan.");
    error.statusCode = 400;
    throw error;
  }

  return createStripeCheckout({ user, planId, request });
}
