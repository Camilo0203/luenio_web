import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import {
  getContactEnv,
  getCrmEnv,
  getDigestEnv,
  getInvitationEnv,
  getMfaEnv,
  getSecurityConfig,
  getServerConfig,
  getStripeEnv,
  getSupabaseEnv,
  getTurnstileEnv,
  isDigestDeliveryConfigured,
  isProduction,
} from "./config/env.js";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) return;
    const [key, ...valueParts] = trimmedLine.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  });
}

if (process.env.LUENIO_SKIP_ENV_FILE !== "true") {
  loadEnvFile();
}

const serverConfig = getServerConfig();
const securityConfig = getSecurityConfig();
const agencyCrmConfig = getCrmEnv();

function assertSecureProductionRuntime() {
  if (!isProduction()) return;
  const failures = [];
  const supabase = getSupabaseEnv();
  const turnstile = getTurnstileEnv();
  const contact = getContactEnv();
  const invitation = getInvitationEnv();
  const mfa = getMfaEnv();
  const stripe = getStripeEnv();
  let appOrigin = null;
  try {
    const appUrl = new URL(serverConfig.appUrl);
    if (appUrl.protocol !== "https:") failures.push("APP_URL must use HTTPS");
    appOrigin = appUrl.hostname.toLowerCase();
  } catch {
    failures.push("APP_URL must be a valid absolute URL");
  }

  if (
    !serverConfig.allowedHosts.length ||
    (appOrigin && !serverConfig.allowedHosts.includes(appOrigin))
  ) {
    failures.push("ALLOWED_HOSTS must include the APP_URL hostname");
  }
  if (!securityConfig.requireTrustedProxy || securityConfig.trustedProxySecret.length < 32) {
    failures.push("trusted proxy enforcement requires a secret of at least 32 characters");
  }
  if (securityConfig.authSecret.length < 32) {
    failures.push("AUTH_SECRET must contain at least 32 characters");
  }
  if (securityConfig.healthcheckToken.length < 32) {
    failures.push("HEALTHCHECK_TOKEN must contain at least 32 characters");
  }
  if (!supabase.required || !supabase.url || !supabase.key) {
    failures.push("Supabase strict storage must be configured");
  }
  try {
    const supabaseUrl = new URL(supabase.url);
    if (supabaseUrl.protocol !== "https:" || supabaseUrl.username || supabaseUrl.password) {
      failures.push("SUPABASE_URL must be a credential-free HTTPS URL");
    }
  } catch {
    failures.push("SUPABASE_URL must be a valid HTTPS URL");
  }
  if (supabase.key.length < 32) failures.push("SUPABASE_SERVICE_ROLE_KEY is invalid");
  if (!turnstile.required || !turnstile.siteKey || !turnstile.secretKey) {
    failures.push("Turnstile must be configured and required");
  }
  if (appOrigin && !turnstile.allowedHostnames.includes(appOrigin)) {
    failures.push("TURNSTILE_ALLOWED_HOSTNAMES must include the APP_URL hostname");
  }
  if (!contact.webhookUrl || contact.webhookToken.length < 32) {
    failures.push("authenticated contact delivery must be configured");
  }
  if (
    !contact.deliveryWorkerEnabled ||
    !Number.isInteger(contact.deliveryWorkerIntervalMs) ||
    contact.deliveryWorkerIntervalMs < 10_000 ||
    contact.deliveryWorkerIntervalMs > 300_000 ||
    !Number.isInteger(contact.deliveryWorkerBatchSize) ||
    contact.deliveryWorkerBatchSize < 1 ||
    contact.deliveryWorkerBatchSize > 50
  ) {
    failures.push("persistent contact delivery retries must be enabled with safe limits");
  }
  if (
    !serverConfig.publicDemoMode &&
    (!invitation.webhookUrl || invitation.webhookToken.length < 32)
  ) {
    failures.push("authenticated invitation and password reset delivery must be configured");
  }
  if (
    !serverConfig.publicDemoMode &&
    (!mfa.requiredForAdmins || !mfa.webhookUrl || mfa.webhookToken.length < 32)
  ) {
    failures.push("administrator MFA delivery must be configured");
  }
  if (stripe.publicBillingEnabled) {
    failures.push("public billing must remain disabled for the reviewed lead-generation release");
  }
  if (agencyCrmConfig.enabled) {
    failures.push("Agency CRM must remain disabled for the initial lead-generation release");
  }
  const digest = getDigestEnv();
  if (serverConfig.publicDemoMode && digest.cronEnabled) {
    failures.push("DIGEST_CRON_ENABLED must remain false while the client portal is disabled");
  }
  if (digest.cronEnabled && !isDigestDeliveryConfigured(digest)) {
    failures.push(
      "DIGEST_CRON_ENABLED requires HTTPS DIGEST_WEBHOOK_URL, DIGEST_WEBHOOK_TOKEN (≥32), and safe worker intervals",
    );
  }
  if (!serverConfig.publicDemoMode) {
    try {
      if (new URL(mfa.webhookUrl).protocol !== "https:")
        failures.push("AUTH_MFA_WEBHOOK_URL must use HTTPS");
    } catch {
      failures.push("AUTH_MFA_WEBHOOK_URL must be a valid URL");
    }
    try {
      if (new URL(invitation.webhookUrl).protocol !== "https:")
        failures.push("INVITATION_WEBHOOK_URL must use HTTPS");
    } catch {
      failures.push("INVITATION_WEBHOOK_URL must be a valid URL");
    }
  }
  try {
    if (new URL(contact.webhookUrl).protocol !== "https:")
      failures.push("CONTACT_WEBHOOK_URL must use HTTPS");
  } catch {
    failures.push("CONTACT_WEBHOOK_URL must be a valid URL");
  }
  if (
    !Number.isInteger(serverConfig.rateLimitMax) ||
    serverConfig.rateLimitMax < 1 ||
    serverConfig.rateLimitMax > 10_000 ||
    !Number.isInteger(serverConfig.sensitiveRateLimitMax) ||
    serverConfig.sensitiveRateLimitMax < 1 ||
    serverConfig.sensitiveRateLimitMax > 1_000 ||
    serverConfig.sensitiveRateLimitMax > serverConfig.rateLimitMax
  ) {
    failures.push("API rate limits are outside safe bounds");
  }
  if (serverConfig.maxBodyBytes < 1_024 || serverConfig.maxBodyBytes > 256_000) {
    failures.push("MAX_BODY_BYTES must be between 1024 and 256000");
  }
  if (serverConfig.maxUrlLength < 512 || serverConfig.maxUrlLength > 8_192) {
    failures.push("MAX_URL_LENGTH must be between 512 and 8192");
  }
  if (
    serverConfig.requestTimeoutMs < 1_000 ||
    serverConfig.requestTimeoutMs > 30_000 ||
    serverConfig.headersTimeoutMs < 1_000 ||
    serverConfig.headersTimeoutMs > serverConfig.requestTimeoutMs ||
    serverConfig.keepAliveTimeoutMs < 1_000 ||
    serverConfig.keepAliveTimeoutMs > 10_000 ||
    !Number.isInteger(serverConfig.maxRequestsPerSocket) ||
    serverConfig.maxRequestsPerSocket < 1 ||
    serverConfig.maxRequestsPerSocket > 1_000 ||
    !Number.isInteger(serverConfig.maxConnections) ||
    serverConfig.maxConnections < 32 ||
    serverConfig.maxConnections > 5_000
  ) {
    failures.push("HTTP timeout or socket limits are outside safe bounds");
  }
  if (
    securityConfig.sessionTtlSeconds < 900 ||
    securityConfig.sessionTtlSeconds > 86_400 ||
    securityConfig.passwordMinLength < 12 ||
    securityConfig.passwordMinLength > 64 ||
    securityConfig.authMaxFailures < 3 ||
    securityConfig.authMaxFailures > 10
  ) {
    failures.push("authentication limits are outside safe bounds");
  }
  const criticalSecrets = [
    securityConfig.authSecret,
    securityConfig.trustedProxySecret,
    securityConfig.healthcheckToken,
    contact.webhookToken,
    ...(!serverConfig.publicDemoMode ? [invitation.webhookToken, mfa.webhookToken] : []),
  ];
  if (new Set(criticalSecrets).size !== criticalSecrets.length) {
    failures.push("production secrets must be unique per trust boundary");
  }
  if (criticalSecrets.some((value) => /change[_-]?me|replace|example/i.test(value))) {
    failures.push("production secrets must not contain placeholder values");
  }
  if (failures.length) {
    throw new Error(`Refusing insecure production startup: ${failures.join("; ")}`);
  }
}

assertSecureProductionRuntime();

// Reject unsafe production configuration before loading the API graph and
// observability SDK. This keeps the fail-closed gate immediate and cheap.
const { initSentry } = await import("./lib/sentry.js");
initSentry();
const { handleApiRoute } = await import("./api/router.js");
const { getSessionUser } = await import("./api/services/auth-service.js");
const { startContactDeliveryWorker, stopContactDeliveryWorker } =
  await import("./api/services/contact-delivery-worker.js");
const { startDigestDeliveryWorker, stopDigestDeliveryWorker } =
  await import("./api/services/digest-delivery-worker.js");

const host = serverConfig.host;
const port = serverConfig.port;
const root = process.cwd();
const distRoot = path.join(root, "dist");
const publicRoot = path.join(root, "public");
const rateLimitWindowMs = 60_000;
const rateLimitMax = serverConfig.rateLimitMax;
const sensitiveRateLimitMax = serverConfig.sensitiveRateLimitMax;
const maxBodyBytes = serverConfig.maxBodyBytes;
const rateLimitBuckets = new Map();
const maxRateLimitBuckets = 25_000;
let rateLimitCleanupCounter = 0;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
const compressibleStaticExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);

function applySecurityHeaders(request, response) {
  const impeccableLiveDevOrigin = isProduction() ? "" : " http://localhost:8400";
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com${impeccableLiveDevOrigin}`,
    // unsafe-inline styles: CRM modules set dynamic widths/progress via element.style
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://www.google-analytics.com",
    `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io${impeccableLiveDevOrigin}`,
    "frame-src https://challenges.cloudflare.com",
    "form-action 'self'",
  ];
  if (isProduction()) cspDirectives.push("upgrade-insecure-requests");

  response.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  const requestPath = String(request.url || "").split("?")[0];
  const containsOneTimeToken = isInvitationPath(requestPath) || isPasswordResetPath(requestPath);
  response.setHeader(
    "Referrer-Policy",
    containsOneTimeToken ? "no-referrer" : "strict-origin-when-cross-origin",
  );
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Origin-Agent-Cluster", "?1");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  const host = String(request.headers.host || "")
    .split(":")[0]
    .toLowerCase();
  if (host === "staging.luenio.com") {
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  if (isProduction()) {
    response.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

function applyApiCacheHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}

function createResponse(nativeResponse) {
  return {
    setHeader(name, value) {
      nativeResponse.setHeader(name, value);
    },
    status(code) {
      nativeResponse.statusCode = code;
      return this;
    },
    json(payload) {
      nativeResponse.setHeader("Content-Type", "application/json; charset=utf-8");
      nativeResponse.end(JSON.stringify(payload));
      return payload;
    },
  };
}

async function parseBody(request) {
  if (request.method === "GET") return undefined;
  const rawBody = await readRequestBody(request);
  if (!rawBody) return {};

  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throwHttpError(400, "JSON body must be an object.");
    }
    return parsed;
  } catch {
    throwHttpError(400, "Invalid JSON body.");
  }
}

async function parseRawBody(request) {
  return readRequestBody(request);
}

async function readRequestBody(request) {
  const contentEncoding = String(request.headers["content-encoding"] || "identity").toLowerCase();
  if (contentEncoding !== "identity") {
    throwHttpError(415, "Compressed request bodies are not accepted.");
  }

  const contentLengthHeader = request.headers["content-length"];
  if (contentLengthHeader !== undefined) {
    const declaredBytes = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      throwHttpError(400, "Invalid Content-Length header.");
    }
    if (declaredBytes > maxBodyBytes) {
      throwHttpError(413, "Request body too large.");
    }
  }

  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      throwHttpError(413, "Request body too large.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function throwHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throwHttpError(400, "Malformed request path.");
  }
}

function getCanonicalPathname(encodedPathname) {
  if (/%2f|%5c|%00/i.test(encodedPathname)) {
    throwHttpError(400, "Ambiguous request path.");
  }
  const pathname = decodePathname(encodedPathname);
  if (pathname.includes("\0") || pathname.includes("\\") || /\/{2,}/.test(pathname)) {
    throwHttpError(400, "Ambiguous request path.");
  }
  return pathname;
}

// A browser asking for a page gets the branded 404 with its header, navigation
// and footer. Asset and API requests keep the plain body: an <img> or a fetch has
// no use for markup, and returning HTML there only wastes bytes.
function wantsHtml(request) {
  return String(request.headers.accept || "").includes("text/html");
}

function sendNotFound(request, response) {
  if (wantsHtml(request)) {
    const appRoot = serverConfig.serveDist ? distRoot : root;
    const notFoundPage = path.join(appRoot, "apps", "web", "pages", "404", "index.html");
    if (fs.existsSync(notFoundPage)) {
      const body = fs.readFileSync(notFoundPage);
      response.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function serveStatic(request, response, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Method not allowed");
    return;
  }

  const filePath = resolvePublicFile(pathname);
  if (!filePath) {
    sendNotFound(request, response);
    return;
  }

  const resolvedPath = path.resolve(filePath);

  if (!isAllowedStaticPath(resolvedPath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    sendNotFound(request, response);
    return;
  }

  const fileStat = fs.statSync(resolvedPath);
  if (fileStat.isDirectory()) {
    sendNotFound(request, response);
    return;
  }

  const extension = path.extname(resolvedPath);
  const headers = {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
  };
  if (
    isAuthPath(pathname) ||
    isDashboardPath(pathname) ||
    isCrmPath(pathname) ||
    isAppPath(pathname) ||
    isInvitationPath(pathname) ||
    isPasswordResetPath(pathname)
  ) {
    headers["Cache-Control"] = "no-store";
  } else if (serverConfig.serveDist && path.posix.dirname(pathname) === "/assets") {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else if (serverConfig.serveDist && pathname.startsWith("/assets/")) {
    headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800";
  }

  const acceptsEncoding = String(request.headers["accept-encoding"] || "");
  const shouldCompress =
    request.method === "GET" &&
    fileStat.size >= 1024 &&
    compressibleStaticExtensions.has(extension);
  let contentEncoding = "";
  if (shouldCompress && /\bbr\b/.test(acceptsEncoding)) contentEncoding = "br";
  else if (shouldCompress && /\bgzip\b/.test(acceptsEncoding)) contentEncoding = "gzip";
  if (contentEncoding) {
    headers["Content-Encoding"] = contentEncoding;
    headers.Vary = "Accept-Encoding";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const source = fs.createReadStream(resolvedPath);
  if (contentEncoding === "br") {
    source
      .pipe(
        zlib.createBrotliCompress({
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
        }),
      )
      .pipe(response);
    return;
  }
  if (contentEncoding === "gzip") {
    source.pipe(zlib.createGzip({ level: 6 })).pipe(response);
    return;
  }
  source.pipe(response);
}

function isInsideRoot(resolvedPath) {
  const normalizedRoot = path.resolve(root);
  return resolvedPath === normalizedRoot || resolvedPath.startsWith(`${normalizedRoot}${path.sep}`);
}

function isInsideDirectory(resolvedPath, directory) {
  const resolvedDirectory = path.resolve(directory);
  return (
    resolvedPath === resolvedDirectory || resolvedPath.startsWith(`${resolvedDirectory}${path.sep}`)
  );
}

function isAllowedStaticPath(resolvedPath) {
  if (!isInsideRoot(resolvedPath)) return false;

  if (serverConfig.serveDist) {
    return isInsideDirectory(resolvedPath, distRoot);
  }

  const allowed = [
    publicRoot,
    path.join(root, "apps", "web"),
    path.join(root, "apps", "admin"),
    path.join(root, "core", "demo-simulator"),
    path.join(root, "styles"),
    path.join(root, "components"),
  ];
  if (serverConfig.serveDist) {
    allowed.push(distRoot);
  }
  return allowed.some((directory) => isInsideDirectory(resolvedPath, directory));
}

function hasUnsafePathSegment(cleanPath) {
  return cleanPath.split(/[\\/]+/).includes("..");
}

function isLandingPath(pathname) {
  return ["/", "/index.html", "/Pagina Luenio", "/Pagina Luenio/"].includes(pathname);
}

function isAuthPath(pathname) {
  return ["/login", "/login/", "/auth.html", "/apps/admin/auth.html"].includes(pathname);
}

function isInvitationPath(pathname) {
  return [
    "/aceptar-invitacion",
    "/aceptar-invitacion/",
    "/invite.html",
    "/apps/admin/invite.html",
  ].includes(pathname);
}

function isPasswordResetPath(pathname) {
  return [
    "/restablecer-acceso",
    "/restablecer-acceso/",
    "/reset.html",
    "/apps/admin/reset.html",
  ].includes(pathname);
}

function isDashboardPath(pathname) {
  return ["/dashboard", "/dashboard/", "/admin", "/admin.html", "/apps/admin/admin.html"].includes(
    pathname,
  );
}

function isCrmPath(pathname) {
  return ["/crm", "/crm/", "/crm.html", "/apps/admin/crm.html"].includes(pathname);
}

/** Post-login workspace hub (choose Leads vs Agencia) */
function isAppPath(pathname) {
  return ["/app", "/app/", "/apps/admin/app.html"].includes(pathname);
}

function isClientPortalPath(pathname) {
  return (
    isAuthPath(pathname) ||
    isInvitationPath(pathname) ||
    isPasswordResetPath(pathname) ||
    isDashboardPath(pathname) ||
    isCrmPath(pathname) ||
    isAppPath(pathname) ||
    pathname.startsWith("/apps/admin/")
  );
}

function isClientPortalApiPath(pathname) {
  return (
    pathname === "/api/auth" ||
    pathname === "/api/billing" ||
    pathname === "/api/stripe-webhook" ||
    pathname === "/api/leads" ||
    pathname === "/api/process" ||
    pathname === "/api/settings" ||
    pathname.startsWith("/api/invitations") ||
    pathname.startsWith("/api/password-reset") ||
    pathname === "/api/crm" ||
    pathname.startsWith("/api/crm/")
  );
}

function blockDisabledClientPortal(request, response, pathname) {
  if (!serverConfig.publicDemoMode) return false;

  if (isClientPortalApiPath(pathname)) {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: false, error: "API route not found." }));
    return true;
  }

  if (!isClientPortalPath(pathname)) return false;
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return true;
  }

  response.writeHead(302, {
    Location: "/demos",
    "Cache-Control": "no-store",
  });
  response.end();
  return true;
}

function getDemoPagePath(pathname) {
  const demoRoutes = {
    "/demo": "index.html",
    "/demo/": "index.html",
    "/demos": "index.html",
    "/demos/": "index.html",
    "/demo/restaurants": path.join("restaurants", "index.html"),
    "/demo/restaurants/": path.join("restaurants", "index.html"),
    "/demos/restaurants": path.join("restaurants", "index.html"),
    "/demos/restaurants/": path.join("restaurants", "index.html"),
    "/demo/real-estate": path.join("real-estate", "index.html"),
    "/demo/real-estate/": path.join("real-estate", "index.html"),
    "/demos/real-estate": path.join("real-estate", "index.html"),
    "/demos/real-estate/": path.join("real-estate", "index.html"),
    "/demo/gym": path.join("gym", "index.html"),
    "/demo/gym/": path.join("gym", "index.html"),
    "/demos/gym": path.join("gym", "index.html"),
    "/demos/gym/": path.join("gym", "index.html"),
    "/demo/ecommerce": path.join("ecommerce", "index.html"),
    "/demo/ecommerce/": path.join("ecommerce", "index.html"),
    "/demos/ecommerce": path.join("ecommerce", "index.html"),
    "/demos/ecommerce/": path.join("ecommerce", "index.html"),
    "/demo/agencies": path.join("agencies", "index.html"),
    "/demo/agencies/": path.join("agencies", "index.html"),
    "/demos/agencies": path.join("agencies", "index.html"),
    "/demos/agencies/": path.join("agencies", "index.html"),
    "/demo/veterinary": path.join("veterinary", "index.html"),
    "/demo/veterinary/": path.join("veterinary", "index.html"),
    "/demos/veterinary": path.join("veterinary", "index.html"),
    "/demos/veterinary/": path.join("veterinary", "index.html"),
    "/demo/aesthetics": path.join("aesthetics", "index.html"),
    "/demo/aesthetics/": path.join("aesthetics", "index.html"),
    "/demos/aesthetics": path.join("aesthetics", "index.html"),
    "/demos/aesthetics/": path.join("aesthetics", "index.html"),
  };

  return demoRoutes[pathname] || null;
}

function getInfoPagePath(pathname) {
  const infoRoutes = {
    "/terminos": path.join("legal", "terminos", "index.html"),
    "/terminos/": path.join("legal", "terminos", "index.html"),
    "/privacidad": path.join("legal", "privacidad", "index.html"),
    "/privacidad/": path.join("legal", "privacidad", "index.html"),
    "/reembolsos": path.join("legal", "reembolsos", "index.html"),
    "/reembolsos/": path.join("legal", "reembolsos", "index.html"),
    "/cotizacion": path.join("pricing", "index.html"),
    "/cotizacion/": path.join("pricing", "index.html"),
    "/precios": path.join("pricing", "index.html"),
    "/precios/": path.join("pricing", "index.html"),
  };

  return infoRoutes[pathname] || null;
}

function getNichePagePath(pathname) {
  const nicheRoutes = {
    "/gym": path.join("gym", "index.html"),
    "/gym/": path.join("gym", "index.html"),
    "/gimnasios": path.join("gym", "index.html"),
    "/gimnasios/": path.join("gym", "index.html"),
    "/restaurants": path.join("restaurants", "index.html"),
    "/restaurants/": path.join("restaurants", "index.html"),
    "/restaurantes": path.join("restaurants", "index.html"),
    "/restaurantes/": path.join("restaurants", "index.html"),
    "/real-estate": path.join("real-estate", "index.html"),
    "/real-estate/": path.join("real-estate", "index.html"),
    "/inmobiliarias": path.join("real-estate", "index.html"),
    "/inmobiliarias/": path.join("real-estate", "index.html"),
    "/ecommerce": path.join("ecommerce", "index.html"),
    "/ecommerce/": path.join("ecommerce", "index.html"),
    "/tiendas-online": path.join("ecommerce", "index.html"),
    "/tiendas-online/": path.join("ecommerce", "index.html"),
    "/agencies": path.join("agencies", "index.html"),
    "/agencies/": path.join("agencies", "index.html"),
    "/agencias": path.join("agencies", "index.html"),
    "/agencias/": path.join("agencies", "index.html"),
    "/veterinary": path.join("veterinary", "index.html"),
    "/veterinary/": path.join("veterinary", "index.html"),
    "/veterinarias": path.join("veterinary", "index.html"),
    "/veterinarias/": path.join("veterinary", "index.html"),
    "/aesthetics": path.join("aesthetics", "index.html"),
    "/aesthetics/": path.join("aesthetics", "index.html"),
    "/esteticas": path.join("aesthetics", "index.html"),
    "/esteticas/": path.join("aesthetics", "index.html"),
  };

  return nicheRoutes[pathname] || null;
}

function resolvePublicFile(pathname) {
  const cleanPath = pathname.replace(/^\/+/, "");
  if (hasUnsafePathSegment(cleanPath)) {
    return null;
  }

  const appRoot = serverConfig.serveDist ? distRoot : root;

  if (isLandingPath(pathname)) {
    return path.join(appRoot, "apps", "web", "pages", "home", "index.html");
  }
  if (isAppPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "app.html");
  }
  if (isDashboardPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "admin.html");
  }
  if (isCrmPath(pathname)) {
    // Prefer Vite-built entry when present; fall back to source for dev
    const distCrm = path.join(distRoot, "apps", "admin", "crm.html");
    if (serverConfig.serveDist && fs.existsSync(distCrm)) return distCrm;
    return path.join(root, "apps", "admin", "crm.html");
  }
  // ES modules for premium CRM UI (dev + production source maps of modules)
  if (cleanPath.startsWith("styles/") || cleanPath.startsWith("components/")) {
    return path.join(root, cleanPath);
  }
  if (cleanPath.startsWith("apps/admin/crm/")) {
    if (!agencyCrmConfig.enabled) return null;
    return path.join(root, cleanPath);
  }
  if (cleanPath.startsWith("core/demo-simulator/")) {
    return path.join(root, cleanPath);
  }
  if (isAuthPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "auth.html");
  }
  if (isInvitationPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "invite.html");
  }
  if (isPasswordResetPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "reset.html");
  }
  const demoPagePath = getDemoPagePath(pathname);
  if (demoPagePath) {
    return path.join(appRoot, "apps", "web", "pages", "demo", demoPagePath);
  }
  const nichePagePath = getNichePagePath(pathname);
  if (nichePagePath) {
    return path.join(appRoot, "apps", "web", "pages", nichePagePath);
  }
  const infoPagePath = getInfoPagePath(pathname);
  if (infoPagePath) {
    return path.join(appRoot, "apps", "web", "pages", infoPagePath);
  }

  if (serverConfig.serveDist) {
    return path.join(distRoot, cleanPath);
  }

  if (cleanPath.startsWith("apps/web/") || cleanPath.startsWith("apps/admin/")) {
    return path.join(root, cleanPath);
  }

  const publicCandidate = path.join(publicRoot, cleanPath);
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }

  return null;
}

function isSensitiveApiPath(pathname) {
  if (pathname.startsWith("/api/invitations")) return true;
  if (pathname.startsWith("/api/password-reset")) return true;
  return [
    "/api/auth",
    "/api/billing",
    "/api/stripe-webhook",
    "/api/contact",
    "/api/leads",
    "/api/process",
    "/api/settings",
  ].includes(pathname);
}

function cleanupRateLimitBuckets(now) {
  rateLimitCleanupCounter += 1;
  if (rateLimitCleanupCounter % 512 !== 0 && rateLimitBuckets.size < maxRateLimitBuckets) return;

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }

  if (rateLimitBuckets.size <= maxRateLimitBuckets) return;
  const excess = rateLimitBuckets.size - maxRateLimitBuckets;
  [...rateLimitBuckets.keys()].slice(0, excess).forEach((key) => rateLimitBuckets.delete(key));
}

function getRateLimitDecision(pathname, clientIp) {
  const ip = clientIp || "unknown";
  const scope = isSensitiveApiPath(pathname) ? pathname : "api";
  const limit = isSensitiveApiPath(pathname) ? sensitiveRateLimitMax : rateLimitMax;
  const bucketKey = `${ip}:${scope}`;
  const now = Date.now();
  cleanupRateLimitBuckets(now);
  const bucket = rateLimitBuckets.get(bucketKey) || { count: 0, resetAt: now + rateLimitWindowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + rateLimitWindowMs;
  }

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);
  return {
    limited: bucket.count > limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

function isMutableMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function hasJsonContentType(request) {
  const contentType = request.headers["content-type"] || request.headers["Content-Type"] || "";
  return String(contentType).toLowerCase().split(";")[0].trim() === "application/json";
}

function rejectUnsupportedApiContentType(request, response, pathname) {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === "/api/stripe-webhook") return false;
  if (!isMutableMethod(request.method)) return false;
  if (hasJsonContentType(request)) return false;

  response.writeHead(415, { "Content-Type": "application/json; charset=utf-8" });
  response.end(
    JSON.stringify({ ok: false, error: "Unsupported media type. Use application/json." }),
  );
  return true;
}

function getAllowedOrigins(request) {
  const origins = new Set();

  if (serverConfig.appUrl) {
    try {
      origins.add(new URL(serverConfig.appUrl).origin);
    } catch {
      // Ignore malformed APP_URL here; readiness will surface configuration problems.
    }
  }

  if (!isProduction()) {
    const host = request.headers.host || "127.0.0.1:4180";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    origins.add(`${protocol}://${host}`);
  }

  return origins;
}

function isOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return !isProduction();
  return getAllowedOrigins(request).has(origin);
}

function rejectCrossOriginMutation(request, response, pathname) {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === "/api/stripe-webhook") return false;
  if (!isMutableMethod(request.method)) return false;
  if (isOriginAllowed(request)) return false;

  response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Cross-origin request blocked." }));
  return true;
}

function isFetchSiteAllowed(request) {
  const fetchSite = String(request.headers["sec-fetch-site"] || "").toLowerCase();
  if (!fetchSite) return true;
  return ["same-origin", "same-site", "none"].includes(fetchSite);
}

function rejectCrossSiteMutation(request, response, pathname) {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === "/api/stripe-webhook") return false;
  if (!isMutableMethod(request.method)) return false;
  if (isFetchSiteAllowed(request)) return false;

  response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Cross-site request blocked." }));
  return true;
}

async function protectDashboardRoute(request, response, pathname) {
  // Premium CRM: public in development (QA); in production only if CRM_PUBLIC=true
  if (isCrmPath(pathname)) {
    if (!isProduction() || process.env.CRM_PUBLIC === "true") return false;
  }

  // Hub /app: always require session in production; open in dev for QA
  if (isAppPath(pathname)) {
    if (!isProduction()) return false;
  }

  if (!isDashboardPath(pathname) && !isCrmPath(pathname) && !isAppPath(pathname)) return false;

  const user = await getSessionUser({ headers: request.headers });
  if (user) return false;

  const next = encodeURIComponent(pathname || "/app");
  response.writeHead(302, {
    Location: `/login?next=${next}`,
    "Cache-Control": "no-store",
  });
  response.end();
  return true;
}

function redirectDisabledWorkspaceRoute(request, response, pathname) {
  if (agencyCrmConfig.enabled || !["GET", "HEAD"].includes(request.method)) return false;
  if (!isCrmPath(pathname) && !isAppPath(pathname)) return false;
  response.writeHead(302, {
    Location: "/dashboard",
    "Cache-Control": "no-store",
  });
  response.end();
  return true;
}

function redirectLegacyPublicRoute(request, response, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) return false;

  if (["/demo", "/demo/"].includes(pathname)) {
    response.writeHead(301, {
      Location: "/demos",
      "Cache-Control": "public, max-age=86400",
    });
    response.end();
    return true;
  }

  if (!["/precios", "/precios/"].includes(pathname)) return false;

  response.writeHead(301, {
    Location: "/cotizacion",
    "Cache-Control": "public, max-age=86400",
  });
  response.end();
  return true;
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isTrustedProxyRequest(request) {
  const securitySecret = securityConfig.trustedProxySecret;
  const providedSecret = request.headers["x-luenio-proxy-secret"] || "";
  return timingSafeEqualString(providedSecret, securitySecret);
}

function rejectUntrustedProxy(request, response) {
  const required = securityConfig.requireTrustedProxy;
  if (!required || isTrustedProxyRequest(request)) return false;
  response.writeHead(421, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end("Misdirected request");
  return true;
}

function normalizeHostname(hostHeader) {
  try {
    const hostname = new URL(`http://${String(hostHeader || "")}`).hostname.toLowerCase();
    return hostname;
  } catch {
    return "";
  }
}

function rejectUnknownHost(request, response) {
  const hostname = normalizeHostname(request.headers.host);
  const developmentHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  const allowed =
    serverConfig.allowedHosts.includes(hostname) ||
    (!isProduction() && developmentHosts.has(hostname));
  if (allowed) return false;
  response.writeHead(421, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end("Misdirected request");
  return true;
}

function getClientIp(request) {
  if (isTrustedProxyRequest(request)) {
    const forwardedIp = String(request.headers["x-real-ip"] || "").trim();
    if (net.isIP(forwardedIp)) return forwardedIp;
  }
  const socketIp = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return net.isIP(socketIp) ? socketIp : "unknown";
}

const server = http.createServer(
  {
    requestTimeout: serverConfig.requestTimeoutMs,
    headersTimeout: serverConfig.headersTimeoutMs,
    keepAliveTimeout: serverConfig.keepAliveTimeoutMs,
    connectionsCheckingInterval: 1_000,
    maxHeaderSize: 16_384,
    requireHostHeader: true,
    insecureHTTPParser: false,
    rejectNonStandardBodyWrites: true,
  },
  async (request, response) => {
    try {
      applySecurityHeaders(request, response);
      const requestId = crypto.randomUUID();
      response.setHeader("X-Request-ID", requestId);
      if (rejectUntrustedProxy(request, response) || rejectUnknownHost(request, response)) return;
      if (!request.url || request.url.length > serverConfig.maxUrlLength) {
        throwHttpError(414, "Request target too long.");
      }
      const requestUrl = new URL(request.url, "http://luenio.internal");
      const pathname = getCanonicalPathname(requestUrl.pathname);
      const clientIp = getClientIp(request);
      if (pathname.startsWith("/api/")) {
        applyApiCacheHeaders(response);
      }
      if (blockDisabledClientPortal(request, response, pathname)) {
        return;
      }
      if (rejectCrossOriginMutation(request, response, pathname)) {
        return;
      }
      if (rejectCrossSiteMutation(request, response, pathname)) {
        return;
      }
      if (rejectUnsupportedApiContentType(request, response, pathname)) {
        return;
      }
      if (pathname.startsWith("/api/")) {
        const rateLimit = getRateLimitDecision(pathname, clientIp);
        response.setHeader("RateLimit-Limit", String(rateLimit.limit));
        response.setHeader("RateLimit-Remaining", String(rateLimit.remaining));
        response.setHeader("RateLimit-Reset", String(rateLimit.resetSeconds));
        if (!rateLimit.limited) {
          // Continue handling the request.
        } else {
          response.writeHead(429, {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(rateLimit.resetSeconds),
          });
          response.end(JSON.stringify({ ok: false, error: "Too many requests" }));
          return;
        }
      }
      const handledApiRoute = await handleApiRoute({
        pathname,
        request: {
          method: request.method,
          headers: request.headers,
          query: Object.fromEntries(requestUrl.searchParams.entries()),
          clientIp,
          requestId,
          [Symbol.asyncIterator]: request[Symbol.asyncIterator].bind(request),
        },
        response,
        createResponse,
        parseBody,
        parseRawBody,
      });
      if (handledApiRoute) {
        return;
      }
      if (pathname.startsWith("/api/")) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false, error: "API route not found." }));
        return;
      }
      if (redirectDisabledWorkspaceRoute(request, response, pathname)) {
        return;
      }
      if (await protectDashboardRoute(request, response, pathname)) {
        return;
      }
      if (redirectLegacyPublicRoute(request, response, pathname)) {
        return;
      }
      serveStatic(request, response, pathname);
    } catch (error) {
      if (response.writableEnded) return;
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        console.error("[Luenio] Unhandled request error", error);
      }
      const message = statusCode >= 500 ? "Internal server error." : error.message;
      response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: message }));
    }
  },
);

server.maxRequestsPerSocket = serverConfig.maxRequestsPerSocket;
server.maxConnections = serverConfig.maxConnections;
server.on("clientError", (_error, socket) => {
  if (!socket.writable) return;
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopContactDeliveryWorker();
  stopDigestDeliveryWorker();
  console.info(`[Luenio] ${signal} received; draining active requests.`);
  server.close(() => process.exit(0));
  const forceTimer = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceTimer.unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function getDisplayHost(listenHost) {
  return ["0.0.0.0", "::"].includes(listenHost) ? "127.0.0.1" : listenHost;
}

function announceServer(portLabel) {
  console.info(`[Luenio] Full SaaS server running at http://${getDisplayHost(host)}:${portLabel}`);
}

function listen(portToUse, allowDevelopmentFallback = !isProduction()) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && allowDevelopmentFallback) {
      console.warn(
        `[Luenio] Port ${portToUse} is in use on ${host}. Falling back to an available development port.`,
      );
      listen(0, false);
      return;
    }

    console.error(`[Luenio] Server failed to start: ${error.message}`);
    process.exit(1);
  });

  server.listen(portToUse, host, () => {
    const address = server.address();
    const activePort = typeof address === "object" && address ? address.port : portToUse;
    announceServer(activePort);
    startContactDeliveryWorker();
    if (!serverConfig.publicDemoMode) startDigestDeliveryWorker();
  });
}

listen(port);
