import { getStorageHealth } from "../db/storage.js";
import { getAutomationEnv, getSecurityConfig, getServerConfig, getStripeEnv, isProduction } from "./env.js";

export function getIntegrationStatus() {
  const automation = getAutomationEnv();
  return {
    webhook: Boolean(automation.webhookUrl),
    crmWebhook: Boolean(automation.crmWebhookUrl),
    whatsapp: Boolean(automation.whatsappWebhookUrl),
    email: Boolean(automation.emailWebhookUrl),
  };
}

export function getSecurityStatus() {
  const security = getSecurityConfig();
  return {
    authSecretConfigured: Boolean(security.authSecret),
    cookieSecure: security.cookieSecure,
    nodeEnv: security.nodeEnv,
  };
}

export function getBillingStatus() {
  const stripe = getStripeEnv();
  return {
    stripeSecretConfigured: Boolean(stripe.secretKey),
    stripeWebhookConfigured: Boolean(stripe.webhookSecret),
    starterPriceConfigured: Boolean(stripe.starterPriceId),
    proPriceConfigured: Boolean(stripe.proPriceId),
    agencyPriceConfigured: Boolean(stripe.agencyPriceId),
  };
}

export function getDeploymentStatus() {
  const server = getServerConfig();
  let appUrlValid = false;

  try {
    const appUrl = new URL(server.appUrl || "");
    appUrlValid = appUrl.protocol === "https:";
  } catch {
    appUrlValid = false;
  }

  return {
    appUrlConfigured: Boolean(server.appUrl),
    appUrlHttps: appUrlValid,
    host: server.host,
    productionMode: isProduction(),
    rateLimitMax: server.rateLimitMax,
    rateLimitsConfigured: server.rateLimitMax > 0 && server.sensitiveRateLimitMax > 0,
    sensitiveRateLimitMax: server.sensitiveRateLimitMax,
    serveDist: server.serveDist,
  };
}

export function buildReadiness() {
  const storage = getStorageHealth();
  const integrations = getIntegrationStatus();
  const security = getSecurityStatus();
  const billing = getBillingStatus();
  const deployment = getDeploymentStatus();

  const checks = [
    {
      id: "deployment_mode",
      label: "Production runtime",
      done: deployment.productionMode,
      severity: "critical",
      description: deployment.productionMode
        ? "NODE_ENV=production is active for runtime behavior."
        : "Set NODE_ENV=production before launch.",
    },
    {
      id: "app_url",
      label: "Public app URL",
      done: deployment.appUrlConfigured && deployment.appUrlHttps,
      severity: "critical",
      description: deployment.appUrlConfigured && deployment.appUrlHttps
        ? "APP_URL is configured with an HTTPS origin."
        : "Set APP_URL to your production HTTPS origin.",
    },
    {
      id: "static_assets",
      label: "Production static assets",
      done: deployment.serveDist,
      severity: "critical",
      description: deployment.serveDist
        ? "Runtime serves built Vite assets from dist."
        : "Use NODE_ENV=production or SERVE_DIST=true after running npm run build.",
    },
    {
      id: "api_rate_limits",
      label: "API rate limits",
      done: deployment.rateLimitsConfigured,
      severity: "critical",
      description: deployment.rateLimitsConfigured
        ? `Global API limit is ${deployment.rateLimitMax}/min and sensitive endpoint limit is ${deployment.sensitiveRateLimitMax}/min.`
        : "Set RATE_LIMIT_MAX and SENSITIVE_RATE_LIMIT_MAX to positive values.",
    },
    {
      id: "database",
      label: "Production database",
      done: storage.mode === "supabase" && storage.supabaseConfigured,
      severity: "critical",
      description: storage.mode === "supabase"
        ? "Supabase is connected for persistent tenant data."
        : "Connect Supabase and enable REQUIRE_SUPABASE=true before launch.",
    },
    {
      id: "auth_secret",
      label: "Session signing secret",
      done: security.authSecretConfigured,
      severity: "critical",
      description: security.authSecretConfigured
        ? "AUTH_SECRET is configured for signed sessions."
        : "Set AUTH_SECRET to a long random value before launch.",
    },
    {
      id: "secure_cookie",
      label: "Secure cookies",
      done: security.cookieSecure,
      severity: "critical",
      description: security.cookieSecure
        ? "Session cookies will use Secure in this environment."
        : "Set COOKIE_SECURE=true or NODE_ENV=production for production cookies.",
    },
    {
      id: "stripe",
      label: "Stripe billing",
      done: billing.stripeSecretConfigured && billing.stripeWebhookConfigured,
      severity: "critical",
      description: "Stripe checkout and webhook are required for subscription changes.",
    },
    {
      id: "stripe_prices",
      label: "Stripe price IDs",
      done: billing.starterPriceConfigured && billing.proPriceConfigured && billing.agencyPriceConfigured,
      severity: "critical",
      description: "Starter, Pro and Agency price IDs must be configured.",
    },
    {
      id: "automation_outputs",
      label: "Automation outputs",
      done: integrations.crmWebhook || integrations.whatsapp || integrations.email || integrations.webhook,
      severity: "recommended",
      description: "Configure CRM, WhatsApp, email or webhook outputs for live notifications.",
    },
  ];

  const critical = checks.filter((check) => check.severity === "critical");
  const criticalReady = critical.every((check) => check.done);
  const ready = checks.every((check) => check.done);

  return {
    ready,
    criticalReady,
    checks,
    storage,
    integrations,
    security,
    billing,
    deployment,
  };
}

export function buildPublicReadiness(readiness = buildReadiness()) {
  return {
    ready: readiness.ready,
    criticalReady: readiness.criticalReady,
    checks: readiness.checks.map(({ id, label, done, severity }) => ({ id, label, done, severity })),
  };
}
