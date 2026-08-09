import fs from "node:fs";
import path from "node:path";
import { getStorageHealth } from "../db/storage.js";
import {
  getAutomationEnv,
  getAnalyticsEnv,
  getContactEnv,
  getDigestEnv,
  getLegalEnv,
  getMfaEnv,
  getSecurityConfig,
  getSentryEnv,
  getServerConfig,
  getStripeEnv,
  getTurnstileEnv,
  isDigestDeliveryConfigured,
  isProduction,
} from "./env.js";

const LEGAL_CONTENT_PAGES = [
  path.join("legal", "terminos", "index.html"),
  path.join("legal", "privacidad", "index.html"),
  path.join("legal", "reembolsos", "index.html"),
];

const PRICING_PAGE = path.join("pricing", "index.html");

function readPublicPage(relativePath, serveDist) {
  const root = process.cwd();
  const appRoot = serveDist ? path.join(root, "dist") : root;
  const filePath = path.join(appRoot, "apps", "web", "pages", relativePath);

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function evaluateLegalContent(pages) {
  const missing = pages.some((content) => content === null);
  const hasPlaceholder = pages.some((content) => content !== null && /\[[^\]]+\]/.test(content));

  return {
    legalPagesFound: !missing,
    legalPlaceholdersReplaced: !missing && !hasPlaceholder,
  };
}

export function evaluatePricingContent(content) {
  return {
    pricingPageFound: content !== null,
    pricingVisible: content !== null && !content.includes("[PRECIO]"),
  };
}

export function getLegalContentStatus(serveDist = getServerConfig().serveDist) {
  const pages = LEGAL_CONTENT_PAGES.map((relativePath) => readPublicPage(relativePath, serveDist));
  return evaluateLegalContent(pages);
}

export function getPricingContentStatus(serveDist = getServerConfig().serveDist) {
  const content = readPublicPage(PRICING_PAGE, serveDist);
  return evaluatePricingContent(content);
}

export function getIntegrationStatus() {
  const automation = getAutomationEnv();
  const contact = getContactEnv();
  return {
    webhook: Boolean(automation.webhookUrl),
    crmWebhook: Boolean(automation.crmWebhookUrl),
    whatsapp: Boolean(automation.whatsappWebhookUrl),
    email: Boolean(automation.emailWebhookUrl),
    contactWebhook: Boolean(contact.webhookUrl),
    contactWebhookAuthenticated: Boolean(contact.webhookUrl && contact.webhookToken),
    contactDeliveryRetries: Boolean(
      contact.deliveryWorkerEnabled &&
      Number.isInteger(contact.deliveryWorkerIntervalMs) &&
      contact.deliveryWorkerIntervalMs >= 10_000 &&
      contact.deliveryWorkerIntervalMs <= 300_000 &&
      Number.isInteger(contact.deliveryWorkerBatchSize) &&
      contact.deliveryWorkerBatchSize >= 1 &&
      contact.deliveryWorkerBatchSize <= 50,
    ),
    automationWebhookAuthenticated: Boolean(
      automation.webhookToken &&
      (automation.webhookUrl ||
        automation.crmWebhookUrl ||
        automation.whatsappWebhookUrl ||
        automation.emailWebhookUrl),
    ),
  };
}

export function getSecurityStatus() {
  const security = getSecurityConfig();
  const mfa = getMfaEnv();
  return {
    authSecretConfigured: Boolean(security.authSecret),
    cookieSecure: security.cookieSecure,
    nodeEnv: security.nodeEnv,
    trustedProxyConfigured: Boolean(
      security.requireTrustedProxy && security.trustedProxySecret.length >= 32,
    ),
    healthcheckProtected: security.healthcheckToken.length >= 32,
    sessionTtlSeconds: security.sessionTtlSeconds,
    passwordMinLength: security.passwordMinLength,
    adminMfaConfigured: Boolean(
      mfa.requiredForAdmins && mfa.webhookUrl && mfa.webhookToken.length >= 32,
    ),
  };
}

export function getBillingStatus() {
  const stripe = getStripeEnv();
  return {
    publicBillingEnabled: stripe.publicBillingEnabled,
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
    allowedHostsConfigured: server.allowedHosts.length > 0,
  };
}

export function buildReadiness() {
  const storage = getStorageHealth();
  const integrations = getIntegrationStatus();
  const security = getSecurityStatus();
  const billing = getBillingStatus();
  const billingSeverity = billing.publicBillingEnabled ? "critical" : "recommended";
  const deployment = getDeploymentStatus();
  const legalContent = getLegalContentStatus(deployment.serveDist);
  const pricingContent = getPricingContentStatus(deployment.serveDist);
  const turnstile = getTurnstileEnv();
  const analytics = getAnalyticsEnv();
  const sentry = getSentryEnv();
  const legal = getLegalEnv();

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
      description:
        deployment.appUrlConfigured && deployment.appUrlHttps
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
      description:
        storage.mode === "supabase"
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
      id: "trusted_proxy",
      label: "Trusted reverse proxy",
      done: security.trustedProxyConfigured,
      severity: "critical",
      description: security.trustedProxyConfigured
        ? "The application rejects traffic that did not pass through the trusted proxy."
        : "Set REQUIRE_TRUSTED_PROXY=true and a random TRUSTED_PROXY_SECRET of at least 32 characters.",
    },
    {
      id: "allowed_hosts",
      label: "Allowed hosts",
      done: deployment.allowedHostsConfigured,
      severity: "critical",
      description: deployment.allowedHostsConfigured
        ? "Host header allowlisting is configured."
        : "Set ALLOWED_HOSTS to the exact public hostnames.",
    },
    {
      id: "private_healthcheck",
      label: "Protected diagnostics",
      done: security.healthcheckProtected,
      severity: "critical",
      description: security.healthcheckProtected
        ? "Detailed health and readiness diagnostics require a private token."
        : "Set HEALTHCHECK_TOKEN to a random value of at least 32 characters.",
    },
    {
      id: "auth_policy",
      label: "Authentication policy",
      done: security.passwordMinLength >= 12 && security.sessionTtlSeconds <= 7 * 24 * 60 * 60,
      severity: "critical",
      description:
        security.passwordMinLength >= 12 && security.sessionTtlSeconds <= 7 * 24 * 60 * 60
          ? "Strong password and bounded session policies are configured."
          : "Require at least 12-character passwords and sessions no longer than seven days.",
    },
    {
      id: "admin_mfa",
      label: "Administrator multi-factor authentication",
      done: security.adminMfaConfigured,
      severity: "critical",
      description: security.adminMfaConfigured
        ? "Administrator sign-in requires a one-time verification code."
        : "Configure ADMIN_MFA_REQUIRED, AUTH_MFA_WEBHOOK_URL and AUTH_MFA_WEBHOOK_TOKEN.",
    },
    {
      id: "stripe",
      label: "Stripe billing",
      done: billing.stripeSecretConfigured && billing.stripeWebhookConfigured,
      severity: billingSeverity,
      description: billing.publicBillingEnabled
        ? "Stripe checkout and webhook are required because public billing is enabled."
        : "Stripe is optional for the lead-gen launch because public billing is disabled.",
    },
    {
      id: "stripe_prices",
      label: "Stripe price IDs",
      done:
        billing.starterPriceConfigured &&
        billing.proPriceConfigured &&
        billing.agencyPriceConfigured,
      severity: billingSeverity,
      description: billing.publicBillingEnabled
        ? "Starter, Pro and Agency price IDs must be configured because public billing is enabled."
        : "Stripe price IDs are optional until public billing is enabled.",
    },
    {
      id: "automation_outputs",
      label: "Automation outputs",
      done:
        integrations.crmWebhook ||
        integrations.whatsapp ||
        integrations.email ||
        integrations.webhook,
      severity: "recommended",
      description: "Configure CRM, WhatsApp, email or webhook outputs for live notifications.",
    },
    {
      id: "automation_authentication",
      label: "Authenticated automation delivery",
      done:
        !(
          integrations.crmWebhook ||
          integrations.whatsapp ||
          integrations.email ||
          integrations.webhook
        ) || integrations.automationWebhookAuthenticated,
      severity: "critical",
      description: integrations.automationWebhookAuthenticated
        ? "Automation deliveries use a bearer token."
        : "Set AUTOMATION_WEBHOOK_TOKEN before enabling automation webhooks.",
    },
    {
      id: "contact_security",
      label: "Public form protection",
      done: turnstile.required && Boolean(turnstile.siteKey && turnstile.secretKey),
      severity: "critical",
      description:
        turnstile.required && turnstile.siteKey && turnstile.secretKey
          ? "Turnstile, honeypot and submission timing checks protect public forms."
          : "Configure TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY and TURNSTILE_REQUIRED=true.",
    },
    {
      id: "contact_delivery",
      label: "Authenticated lead delivery",
      done: integrations.contactWebhookAuthenticated,
      severity: "critical",
      description: integrations.contactWebhookAuthenticated
        ? "Contact leads are delivered to an authenticated workflow after persistence."
        : "Configure CONTACT_WEBHOOK_URL and CONTACT_WEBHOOK_TOKEN for n8n delivery.",
    },
    {
      id: "contact_delivery_retries",
      label: "Persistent lead delivery retries",
      done: integrations.contactDeliveryRetries,
      severity: "critical",
      description: integrations.contactDeliveryRetries
        ? "Failed notifications remain queued and are retried with bounded backoff."
        : "Enable CONTACT_DELIVERY_WORKER_ENABLED with a safe interval and batch size.",
    },
    {
      id: "legal_placeholders_replaced",
      label: "Legal pages ready",
      done: legalContent.legalPagesFound && legalContent.legalPlaceholdersReplaced,
      severity: "critical",
      description: legalContent.legalPlaceholdersReplaced
        ? "Terms, Privacy, and Refund pages have no unreplaced [placeholder] tokens."
        : "Replace every public [placeholder] token in Terms/Privacy/Refund pages and have the copy reviewed before launch.",
    },
    {
      id: "legal_identity",
      label: "Responsible legal identity",
      done: legal.identityReady,
      severity: "critical",
      description: legal.identityReady
        ? "The responsible legal identity has been reviewed and published."
        : "Define and review the responsible legal identity before public launch.",
    },
    {
      id: "analytics",
      label: "Consent-based analytics",
      done: Boolean(analytics.gaMeasurementId),
      severity: "critical",
      description: analytics.gaMeasurementId
        ? "GA4 is configured and will load only after analytics consent."
        : "Set GA_MEASUREMENT_ID before launch; analytics loads only after consent.",
    },
    {
      id: "observability",
      label: "Error observability",
      done: sentry.configured,
      severity: "critical",
      description: sentry.configured
        ? "Server and browser Sentry DSNs are configured."
        : "Configure separate SENTRY_DSN_SERVER and SENTRY_DSN_PUBLIC values.",
    },
    {
      id: "digest_delivery",
      label: "Daily digest webhook (optional)",
      done: (() => {
        const digest = getDigestEnv();
        if (!digest.cronEnabled) return true;
        return isDigestDeliveryConfigured(digest);
      })(),
      severity: "recommended",
      description: (() => {
        const digest = getDigestEnv();
        if (!digest.cronEnabled) {
          return "Digest cron is disabled (DIGEST_CRON_ENABLED=false). Enable only with HTTPS webhook + token.";
        }
        return isDigestDeliveryConfigured(digest)
          ? "Digest worker is configured with authenticated HTTPS webhook and safe intervals."
          : "Set DIGEST_WEBHOOK_URL (HTTPS), DIGEST_WEBHOOK_TOKEN (≥32), and valid DIGEST_WORKER_INTERVAL_MS / DIGEST_MIN_HOURS_BETWEEN.";
      })(),
    },
    {
      id: "pricing_visible",
      label: "Pricing visible",
      done: pricingContent.pricingPageFound && pricingContent.pricingVisible,
      severity: "recommended",
      description: pricingContent.pricingVisible
        ? "The public pricing page shows real pricing guidance or a clear consultation model."
        : "Replace the [PRECIO] placeholder on the pricing page with real pricing guidance.",
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
    legalContent,
    pricingContent,
    turnstile: {
      required: turnstile.required,
      configured: Boolean(turnstile.siteKey && turnstile.secretKey),
    },
    analytics: { configured: Boolean(analytics.gaMeasurementId) },
    legal: { identityReady: legal.identityReady },
  };
}

export function buildPublicReadiness(readiness = buildReadiness()) {
  return {
    ready: readiness.ready,
    criticalReady: readiness.criticalReady,
    checks: readiness.checks.map(({ id, label, done, severity }) => ({
      id,
      label,
      done,
      severity,
    })),
  };
}
