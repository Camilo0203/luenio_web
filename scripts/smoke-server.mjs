import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const isProductionSmoke = process.argv.includes("--production");
const testProxySecret = "luenio-production-smoke-proxy-secret-123456789";
const testHealthcheckToken = "luenio-production-healthcheck-token-123456789";
const productionSmokeEnv = {
  LUENIO_SKIP_ENV_FILE: "true",
  NODE_ENV: "production",
  APP_URL: "https://luenio.com",
  ALLOWED_HOSTS: "luenio.com,127.0.0.1",
  REQUIRE_TRUSTED_PROXY: "true",
  TRUSTED_PROXY_SECRET: testProxySecret,
  HEALTHCHECK_TOKEN: testHealthcheckToken,
  AUTH_SECRET: "luenio-production-smoke-auth-secret-123456789",
  REQUIRE_SUPABASE: "true",
  SUPABASE_URL: "https://smoke-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "luenio-smoke-supabase-service-role-key-123456789",
  TURNSTILE_REQUIRED: "true",
  TURNSTILE_SITE_KEY: "smoke-test-site-key",
  TURNSTILE_SECRET_KEY: "smoke-test-secret-key",
  CONTACT_WEBHOOK_URL: "https://automation.luenio.com/webhook/smoke-test",
  CONTACT_WEBHOOK_TOKEN: "luenio-smoke-contact-token-123456789012345",
  CONTACT_DELIVERY_WORKER_ENABLED: "true",
  CONTACT_DELIVERY_WORKER_INTERVAL_MS: "30000",
  CONTACT_DELIVERY_WORKER_BATCH_SIZE: "10",
  INVITATION_WEBHOOK_URL: "https://automation.luenio.com/webhook/smoke-invitation",
  INVITATION_WEBHOOK_TOKEN: "luenio-smoke-invitation-token-123456789012345",
  ADMIN_MFA_REQUIRED: "true",
  AUTH_MFA_WEBHOOK_URL: "https://automation.luenio.com/webhook/smoke-mfa",
  AUTH_MFA_WEBHOOK_TOKEN: "luenio-smoke-mfa-token-123456789012345678",
  MAX_BODY_BYTES: "64000",
};
const nativeFetch = globalThis.fetch;
if (isProductionSmoke) {
  globalThis.fetch = (input, options = {}) =>
    nativeFetch(input, {
      ...options,
      headers: {
        Host: "luenio.com",
        "X-Luenio-Proxy-Secret": testProxySecret,
        ...(options.headers || {}),
      },
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rawRequest(baseUrl, pathname, headers = {}) {
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
      },
      (response) => {
        response.resume();
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headers }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the server is ready or the timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function expectTextRoute(baseUrl, pathname, expectedText) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const body = await response.text();
  assert(response.ok, `${pathname} must return 200.`);
  assert(body.includes(expectedText), `${pathname} must include ${expectedText}.`);
  return body;
}

async function expectOkRoute(baseUrl, pathname, expectedContentType) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.ok, `${pathname} must return 200.`);
  if (expectedContentType) {
    const contentType = response.headers.get("content-type") || "";
    assert(
      contentType.includes(expectedContentType),
      `${pathname} must include content-type ${expectedContentType}.`,
    );
  }
  return response;
}

function expectSecurityHeaders(response, { production = false } = {}) {
  const csp = response.headers.get("content-security-policy") || "";
  assert(csp.includes("default-src 'self'"), "Responses must set a self-restricted CSP.");
  assert(csp.includes("object-src 'none'"), "CSP must block plugin/object execution.");
  assert(csp.includes("frame-ancestors 'none'"), "CSP must block framing ancestors.");
  assert(csp.includes("script-src 'self'"), "CSP must restrict scripts to same-origin assets.");
  assert(response.headers.get("x-frame-options") === "DENY", "Responses must deny framing.");
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "Responses must set nosniff.",
  );
  assert(
    response.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
    "Responses must set referrer policy.",
  );
  assert(
    response.headers.get("cross-origin-opener-policy") === "same-origin",
    "Responses must isolate the top-level browsing context.",
  );
  assert(
    response.headers.get("cross-origin-resource-policy") === "same-origin",
    "Responses must prevent unintended cross-origin embedding.",
  );
  if (production) {
    assert(
      response.headers.get("strict-transport-security")?.includes("max-age=63072000"),
      "Production responses must set HSTS.",
    );
  }
}

async function expectNotExposed(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(!response.ok, `${pathname} must not expose project files.`);
}

async function expectInsecureProductionStartupRejected() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...productionSmokeEnv,
      HOST: "127.0.0.1",
      PORT: String(port),
      INVITATION_WEBHOOK_URL: "http://automation.luenio.com/webhook/insecure",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const result = await new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve({ code: null, timedOut: true }), 5_000);
    child.once("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ code, timedOut: false });
    });
  });
  if (result.timedOut && child.exitCode === null) child.kill();
  assert(!result.timedOut, "Insecure production startup must fail immediately.");
  assert(result.code !== 0, "Insecure production startup must return a failure code.");
  assert(
    output.includes("Refusing insecure production startup"),
    "Production startup failure must identify the security gate.",
  );
}

async function runSmoke() {
  if (isProductionSmoke) await expectInsecureProductionStartupRejected();
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ...(isProductionSmoke ? productionSmokeEnv : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const closePromise = new Promise((resolve) => {
    server.once("close", resolve);
  });

  try {
    await waitForServer(baseUrl);

    const landingResponse = await fetch(`${baseUrl}/`);
    const landingHtml = await landingResponse.text();
    assert(landingResponse.ok, "/ must return 200.");
    assert(landingHtml.includes(">Luenio</span>"), "/ must render the Luenio brand.");
    expectSecurityHeaders(landingResponse, { production: isProductionSmoke });
    const jpgAssetResponse = await fetch(`${baseUrl}/assets/stitch/gym-05.jpg`);
    assert(jpgAssetResponse.ok, "Niche JPG assets must be served.");
    assert(
      jpgAssetResponse.headers.get("content-type") === "image/jpeg",
      "Niche JPG assets must use the image/jpeg MIME type.",
    );
    await expectTextRoute(baseUrl, "/Pagina%20Luenio", ">Luenio</span>");
    const demoSelectorHtml = await expectTextRoute(baseUrl, "/demo", "Revisar flujo");
    assert(
      demoSelectorHtml.includes('content="noindex, nofollow"'),
      "Demo selector must be noindex for the lead-gen launch.",
    );
    const demosAliasHtml = await expectTextRoute(baseUrl, "/demos", "Revisar flujo");
    assert(
      demosAliasHtml.includes("Prueba la demo de tu industria"),
      "/demos must render the complete demo catalog.",
    );
    for (const demoRoute of [
      "/demos/restaurants",
      "/demos/real-estate",
      "/demos/gym",
      "/demos/ecommerce",
      "/demos/agencies",
      "/demos/veterinary",
      "/demos/aesthetics",
    ]) {
      const demoHtml = await expectTextRoute(baseUrl, demoRoute, "Ejecutar Demo en Vivo");
      assert(
        demoHtml.includes('content="noindex, nofollow"'),
        `${demoRoute} must be noindex for the lead-gen launch.`,
      );
    }
    for (const nicheRoute of [
      "/gym",
      "/restaurants",
      "/real-estate",
      "/ecommerce",
      "/agencies",
      "/veterinary",
      "/aesthetics",
    ]) {
      const nicheHtml = await expectTextRoute(baseUrl, nicheRoute, "Luenio");
      assert(
        nicheHtml.includes('content="noindex, nofollow"'),
        `${nicheRoute} must be noindex for the lead-gen launch.`,
      );
    }
    for (const aliasRoute of [
      "/gimnasios",
      "/restaurantes",
      "/inmobiliarias",
      "/tiendas-online",
      "/agencias",
      "/veterinarias",
      "/esteticas",
    ]) {
      const aliasHtml = await expectTextRoute(baseUrl, aliasRoute, "Luenio");
      assert(
        aliasHtml.includes('content="noindex, nofollow"'),
        `${aliasRoute} must route to a noindex industry landing.`,
      );
    }
    await expectTextRoute(baseUrl, "/login", "Bienvenido de nuevo.");
    await expectTextRoute(baseUrl, "/terminos", "Términos de Servicio");
    await expectTextRoute(baseUrl, "/privacidad", "Política de Privacidad");
    await expectTextRoute(baseUrl, "/reembolsos", "Política de Reembolsos");
    const quoteHtml = await expectTextRoute(
      baseUrl,
      "/cotizacion",
      "Una solución diseñada alrededor de tu negocio.",
    );
    assert(!quoteHtml.includes("[PRECIO]"), "Quote page must not expose price placeholders.");
    assert(!quoteHtml.includes("Desde 500 USD"), "Quote page must not expose generic pricing.");
    const legacyPricing = await fetch(`${baseUrl}/precios`, { redirect: "manual" });
    assert(legacyPricing.status === 301, "/precios must permanently redirect.");
    assert(
      legacyPricing.headers.get("location") === "/cotizacion",
      "/precios must redirect to /cotizacion.",
    );
    await expectTextRoute(baseUrl, "/robots.txt", "Sitemap: https://luenio.com/sitemap.xml");
    const sitemapResponse = await expectOkRoute(baseUrl, "/sitemap.xml", "application/xml");
    const sitemapXml = await sitemapResponse.text();
    assert(sitemapXml.includes("https://luenio.com/"), "Sitemap must include the homepage.");
    assert(!sitemapXml.includes("/demo"), "Sitemap must not include demo routes.");
    await expectOkRoute(baseUrl, "/favicon.png", "image/png");
    await expectOkRoute(baseUrl, "/site.webmanifest", "application/manifest+json");
    await expectTextRoute(baseUrl, "/aceptar-invitacion", "Activa tu espacio de trabajo");
    await expectTextRoute(baseUrl, "/restablecer-acceso", "Recupera tu acceso");
    const faviconHead = await fetch(`${baseUrl}/favicon.png`, { method: "HEAD" });
    assert(faviconHead.ok, "HEAD /favicon.png must return 200.");
    assert((await faviconHead.text()) === "", "HEAD responses must not include a body.");
    const invalidStaticMethod = await fetch(`${baseUrl}/login`, { method: "POST" });
    assert(invalidStaticMethod.status === 405, "Static routes must reject unsupported methods.");
    assert(
      invalidStaticMethod.headers.get("allow") === "GET, HEAD",
      "Static method rejection must advertise GET, HEAD.",
    );
    await expectNotExposed(baseUrl, "/package.json");
    await expectNotExposed(baseUrl, "/.env");
    await expectNotExposed(baseUrl, "/%2e%2e/package.json");
    const malformedPath = await fetch(`${baseUrl}/%E0%A4%A`);
    const malformedPathBody = await malformedPath.json();
    assert(malformedPath.status === 400, "Malformed encoded paths must return 400, not 500.");
    assert(
      malformedPathBody.error === "Malformed request path.",
      "Malformed path errors must be explicit.",
    );
    const encodedAdminPath = await fetch(`${baseUrl}/apps%2Fadmin%2Fadmin.html`, {
      redirect: "manual",
    });
    assert(
      encodedAdminPath.status === 400,
      "Encoded path separators must be rejected before protected-route checks.",
    );
    const duplicateSlashPath = await fetch(`${baseUrl}/apps//admin/admin.html`, {
      redirect: "manual",
    });
    assert(
      duplicateSlashPath.status === 400,
      "Duplicate path separators must be rejected before static routing.",
    );

    if (isProductionSmoke) {
      assert(
        landingHtml.includes("/assets/"),
        "Production landing must reference built Vite assets.",
      );
      assert(
        !landingHtml.includes("/apps/web/src/"),
        "Production landing must not reference source modules.",
      );

      const builtAssetPath = landingHtml.match(/\/assets\/[^"']+\.js/)?.[0];
      assert(builtAssetPath, "Production landing must include a built JavaScript asset.");
      const builtAsset = await expectOkRoute(baseUrl, builtAssetPath, "text/javascript");
      assert(
        builtAsset.headers.get("cache-control") === "public, max-age=31536000, immutable",
        "Built assets must use immutable cache headers.",
      );
      assert(
        jpgAssetResponse.headers.get("cache-control") ===
          "public, max-age=86400, stale-while-revalidate=604800",
        "Public images must be cached but remain safely refreshable.",
      );
    } else {
      assert(
        landingHtml.includes("/apps/web/src/public-site.js"),
        "Development landing must reference source modules.",
      );
    }

    const admin = await fetch(`${baseUrl}/admin.html`, { redirect: "manual" });
    assert(admin.status === 302, "Protected admin route must redirect.");
    assert(
      admin.headers.get("location") === "/login?next=%2Fadmin.html",
      "Admin redirect must preserve its post-login destination.",
    );

    const dashboard = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    assert(dashboard.status === 302, "Protected dashboard route must redirect.");
    assert(
      dashboard.headers.get("location") === "/login?next=%2Fdashboard",
      "Dashboard redirect must preserve its post-login destination.",
    );
    const internalDashboard = await fetch(`${baseUrl}/apps/admin/admin.html`, {
      redirect: "manual",
    });
    assert(
      internalDashboard.status === 302 &&
        internalDashboard.headers.get("location") === "/login?next=%2Fapps%2Fadmin%2Fadmin.html",
      "Internal dashboard HTML path must enforce the same authentication boundary.",
    );

    const unknownApi = await fetch(`${baseUrl}/api/nope`);
    const unknownApiBody = await unknownApi.json();
    assert(unknownApi.status === 404, "Unknown API route must return 404.");
    assert(
      unknownApiBody.error === "API route not found.",
      "Unknown API route must return a JSON error.",
    );

    const health = await fetch(`${baseUrl}/api/health`);
    const healthBody = await health.json();
    assert(health.ok, "Health route must return 200.");
    assert(healthBody.ok === true, "Health route must return ok=true.");
    assert(
      !healthBody.storage && !healthBody.integrations && !healthBody.readiness,
      "Public health must not expose infrastructure diagnostics.",
    );
    if (isProductionSmoke) {
      const missingProxy = await nativeFetch(`${baseUrl}/api/health`, {
        headers: { Host: "luenio.com" },
      });
      assert(missingProxy.status === 421, "Production must reject requests that bypass Caddy.");

      const unknownHost = await rawRequest(baseUrl, "/api/health", {
        Host: "attacker.example",
        "X-Luenio-Proxy-Secret": testProxySecret,
      });
      assert(unknownHost.status === 421, "Production must reject unrecognized Host headers.");

      const privateHealthWithoutToken = await fetch(`${baseUrl}/api/health?details=1`);
      assert(
        privateHealthWithoutToken.status === 401,
        "Detailed health must reject requests without its bearer token.",
      );
      const privateHealth = await fetch(`${baseUrl}/api/health?details=1`, {
        headers: { Authorization: `Bearer ${testHealthcheckToken}` },
      });
      const privateHealthBody = await privateHealth.json();
      assert(
        [200, 503].includes(privateHealth.status) && privateHealthBody.readiness,
        "Authorized diagnostics must return protected readiness details.",
      );

      const originlessMutation = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert(
        originlessMutation.status === 403,
        "Production mutations must fail closed when Origin is missing.",
      );
    }
    const publicConfig = await fetch(`${baseUrl}/api/public-config`);
    const publicConfigBody = await publicConfig.json();
    assert(publicConfig.ok, "Public config route must return 200.");
    assert(
      Object.keys(publicConfigBody).sort().join(",") ===
        "analyticsEnabled,environment,gaMeasurementId,sentryDsn,turnstileRequired,turnstileSiteKey",
      "Public config must expose only allowlisted browser configuration.",
    );
    assert(
      !JSON.stringify(publicConfigBody).includes("SECRET") &&
        !JSON.stringify(publicConfigBody).includes("TOKEN"),
      "Public config must never expose server secrets.",
    );

    console.info(isProductionSmoke ? "Production server smoke passed" : "Server smoke passed");
  } catch (error) {
    error.message = `${error.message}\n\nServer output:\n${output || "(no output)"}`;
    throw error;
  } finally {
    if (server.exitCode === null && !server.killed) {
      server.kill();
      await closePromise;
    }
  }
}

await runSmoke();
