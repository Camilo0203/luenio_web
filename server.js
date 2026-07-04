import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { getServerConfig, isProduction } from "./config/env.js";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) return;
    const [key, ...valueParts] = trimmedLine.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

loadEnvFile();

const { handleApiRoute } = await import("./api/router.js");
const { getSessionUser } = await import("./api/services/auth-service.js");

const serverConfig = getServerConfig();
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
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

function applySecurityHeaders(response) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
  ].join("; ");

  response.setHeader("Content-Security-Policy", csp);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (serverConfig.serveDist) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
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
    return JSON.parse(rawBody);
  } catch {
    throwHttpError(400, "Invalid JSON body.");
  }
}

async function parseRawBody(request) {
  return readRequestBody(request);
}

async function readRequestBody(request) {
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

function serveStatic(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Method not allowed");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodePathname(requestUrl.pathname);
  const filePath = resolvePublicFile(pathname);
  if (!filePath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const resolvedPath = path.resolve(filePath);

  if (!isAllowedStaticPath(resolvedPath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const headers = {
    "Content-Type": mimeTypes[path.extname(resolvedPath)] || "application/octet-stream",
  };
  if (isAuthPath(pathname) || isDashboardPath(pathname)) {
    headers["Cache-Control"] = "no-store";
  } else if (serverConfig.serveDist && pathname.startsWith("/assets/")) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(resolvedPath).pipe(response);
}

function isInsideRoot(resolvedPath) {
  const normalizedRoot = path.resolve(root);
  return resolvedPath === normalizedRoot || resolvedPath.startsWith(`${normalizedRoot}${path.sep}`);
}

function isInsideDirectory(resolvedPath, directory) {
  const resolvedDirectory = path.resolve(directory);
  return resolvedPath === resolvedDirectory || resolvedPath.startsWith(`${resolvedDirectory}${path.sep}`);
}

function isAllowedStaticPath(resolvedPath) {
  if (!isInsideRoot(resolvedPath)) return false;

  if (serverConfig.serveDist) {
    return isInsideDirectory(resolvedPath, distRoot);
  }

  return [
    publicRoot,
    path.join(root, "apps", "web"),
    path.join(root, "apps", "admin"),
  ].some((directory) => isInsideDirectory(resolvedPath, directory));
}

function hasUnsafePathSegment(cleanPath) {
  return cleanPath.split(/[\\/]+/).includes("..");
}

function isLandingPath(pathname) {
  return ["/", "/index.html", "/Pagina Luenio", "/Pagina Luenio/"].includes(pathname);
}

function isAuthPath(pathname) {
  return ["/login", "/login/", "/auth.html"].includes(pathname);
}

function isDashboardPath(pathname) {
  return ["/dashboard", "/dashboard/", "/admin", "/admin.html"].includes(pathname);
}

function getDemoPagePath(pathname) {
  const demoRoutes = {
    "/demo": "index.html",
    "/demo/": "index.html",
    "/demo/restaurants": path.join("restaurants", "index.html"),
    "/demo/restaurants/": path.join("restaurants", "index.html"),
    "/demo/real-estate": path.join("real-estate", "index.html"),
    "/demo/real-estate/": path.join("real-estate", "index.html"),
    "/demo/gym": path.join("gym", "index.html"),
    "/demo/gym/": path.join("gym", "index.html"),
    "/demo/ecommerce": path.join("ecommerce", "index.html"),
    "/demo/ecommerce/": path.join("ecommerce", "index.html"),
    "/demo/agencies": path.join("agencies", "index.html"),
    "/demo/agencies/": path.join("agencies", "index.html"),
  };

  return demoRoutes[pathname] || null;
}

function getNichePagePath(pathname) {
  const nicheRoutes = {
    "/gym": path.join("gym", "index.html"),
    "/gym/": path.join("gym", "index.html"),
    "/restaurants": path.join("restaurants", "index.html"),
    "/restaurants/": path.join("restaurants", "index.html"),
    "/real-estate": path.join("real-estate", "index.html"),
    "/real-estate/": path.join("real-estate", "index.html"),
    "/ecommerce": path.join("ecommerce", "index.html"),
    "/ecommerce/": path.join("ecommerce", "index.html"),
    "/agencies": path.join("agencies", "index.html"),
    "/agencies/": path.join("agencies", "index.html"),
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
  if (isDashboardPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "admin.html");
  }
  if (isAuthPath(pathname)) {
    return path.join(appRoot, "apps", "admin", "auth.html");
  }
  const demoPagePath = getDemoPagePath(pathname);
  if (demoPagePath) {
    return path.join(appRoot, "apps", "web", "pages", "demo", demoPagePath);
  }
  const nichePagePath = getNichePagePath(pathname);
  if (nichePagePath) {
    return path.join(appRoot, "apps", "web", "pages", nichePagePath);
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
  return [
    "/api/auth",
    "/api/billing",
    "/api/contact",
    "/api/leads",
    "/api/process",
    "/api/settings",
  ].includes(pathname);
}

function isRateLimited(request, pathname) {
  const ip = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "local";
  const scope = isSensitiveApiPath(pathname) ? pathname : "api";
  const limit = isSensitiveApiPath(pathname) ? sensitiveRateLimitMax : rateLimitMax;
  const bucketKey = `${ip}:${scope}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(bucketKey) || { count: 0, resetAt: now + rateLimitWindowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + rateLimitWindowMs;
  }

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);
  return bucket.count > limit;
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
  response.end(JSON.stringify({ ok: false, error: "Unsupported media type. Use application/json." }));
  return true;
}

function getAllowedOrigins(request) {
  const host = request.headers.host || "127.0.0.1:4180";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const origins = new Set([`${protocol}://${host}`]);

  if (serverConfig.appUrl) {
    try {
      origins.add(new URL(serverConfig.appUrl).origin);
    } catch {
      // Ignore malformed APP_URL here; readiness will surface configuration problems.
    }
  }

  return origins;
}

function isOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
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
  if (!isDashboardPath(pathname)) return false;
  const user = await getSessionUser({ headers: request.headers });
  if (user) return false;

  response.writeHead(302, {
    Location: "/login",
    "Cache-Control": "no-store",
  });
  response.end();
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    applySecurityHeaders(response);
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      applyApiCacheHeaders(response);
    }
    if (rejectCrossOriginMutation(request, response, requestUrl.pathname)) {
      return;
    }
    if (rejectCrossSiteMutation(request, response, requestUrl.pathname)) {
      return;
    }
    if (rejectUnsupportedApiContentType(request, response, requestUrl.pathname)) {
      return;
    }
    if (requestUrl.pathname.startsWith("/api/") && requestUrl.pathname !== "/api/health" && isRateLimited(request, requestUrl.pathname)) {
      response.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "Too many requests" }));
      return;
    }
    const handledApiRoute = await handleApiRoute({
      pathname: requestUrl.pathname,
      request: {
        method: request.method,
        headers: request.headers,
        query: Object.fromEntries(requestUrl.searchParams.entries()),
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
    if (requestUrl.pathname.startsWith("/api/")) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "API route not found." }));
      return;
    }
    if (await protectDashboardRoute(request, response, requestUrl.pathname)) {
      return;
    }
    serveStatic(request, response);
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
});

function getDisplayHost(listenHost) {
  return ["0.0.0.0", "::"].includes(listenHost) ? "127.0.0.1" : listenHost;
}

function announceServer(portLabel) {
  console.info(`[Luenio] Full SaaS server running at http://${getDisplayHost(host)}:${portLabel}`);
}

function listen(portToUse, allowDevelopmentFallback = !isProduction()) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && allowDevelopmentFallback) {
      console.warn(`[Luenio] Port ${portToUse} is in use on ${host}. Falling back to an available development port.`);
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
  });
}

listen(port);
