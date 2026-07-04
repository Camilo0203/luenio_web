const envKeys = [
  "NODE_ENV",
  "APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_STARTER_PRICE_ID",
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;

process.env.NODE_ENV = "production";
process.env.STRIPE_SECRET_KEY = "sk_test_checkout_guard";
process.env.STRIPE_STARTER_PRICE_ID = "price_checkout_guard";

const { createStripeCheckout } = await import("../api/services/billing-service.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejectsWith(operation, expectedMessage, label) {
  try {
    await operation();
  } catch (error) {
    assert(error.statusCode === 503, `${label} must fail as a service configuration error.`);
    assert(error.message === expectedMessage, `${label} must fail with "${expectedMessage}", got "${error.message}".`);
    return;
  }
  throw new Error(`${label} must reject.`);
}

const user = {
  id: "user_checkout_guard",
  email: "checkout-guard@luenio.test",
};
const request = {
  headers: {
    host: "attacker.example",
  },
};

try {
  delete process.env.APP_URL;
  await assertRejectsWith(
    () => createStripeCheckout({ user, planId: "starter", request }),
    "APP_URL is required for Stripe checkout in production.",
    "Missing production APP_URL"
  );

  process.env.APP_URL = "http://luenio.example";
  await assertRejectsWith(
    () => createStripeCheckout({ user, planId: "starter", request }),
    "APP_URL must use HTTPS in production.",
    "Insecure production APP_URL"
  );

  let stripePayload = null;
  globalThis.fetch = async (url, options) => {
    assert(url === "https://api.stripe.com/v1/checkout/sessions", "Checkout must call Stripe sessions API.");
    stripePayload = new URLSearchParams(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "cs_test_checkout_guard", url: "https://checkout.stripe.test/session" }),
    };
  };

  process.env.APP_URL = "https://luenio.example/app";
  const checkout = await createStripeCheckout({ user, planId: "starter", request });
  assert(checkout.id === "cs_test_checkout_guard", "Checkout response must pass through Stripe session id.");
  assert(stripePayload.get("success_url") === "https://luenio.example/dashboard?billing=success", "Checkout success URL must use production APP_URL origin.");
  assert(stripePayload.get("cancel_url") === "https://luenio.example/dashboard?billing=cancelled", "Checkout cancel URL must use production APP_URL origin.");
  assert(stripePayload.get("success_url").includes("attacker.example") === false, "Checkout URLs must not trust request Host in production.");

  console.info("Billing checkout guard passed");
} finally {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
  globalThis.fetch = previousFetch;
}
