import { spawn } from "node:child_process";
import net from "node:net";

const isProductionSmoke = process.argv.includes("--production");

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  if (production) {
    assert(
      response.headers.get("strict-transport-security")?.includes("max-age=31536000"),
      "Production responses must set HSTS.",
    );
  }
}

async function expectNotExposed(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(!response.ok, `${pathname} must not expose project files.`);
}

async function runSmoke() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ...(isProductionSmoke ? { NODE_ENV: "production" } : {}),
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
    assert(landingHtml.includes("Luenio Agency"), "/ must render Luenio Agency.");
    expectSecurityHeaders(landingResponse, { production: isProductionSmoke });
    await expectTextRoute(baseUrl, "/Pagina%20Luenio", "Luenio Agency");
    await expectTextRoute(baseUrl, "/demo", "Descubre dónde estás perdiendo clientes hoy.");
    await expectTextRoute(baseUrl, "/demo/restaurants", "Ejecutar Demo en Vivo");
    await expectTextRoute(baseUrl, "/demo/real-estate", "Ejecutar Demo en Vivo");
    await expectTextRoute(baseUrl, "/demo/gym", "Ejecutar Demo en Vivo");
    await expectTextRoute(baseUrl, "/demo/ecommerce", "Ejecutar Demo en Vivo");
    await expectTextRoute(baseUrl, "/demo/agencies", "Ejecutar Demo en Vivo");
    await expectTextRoute(
      baseUrl,
      "/gym",
      "Estás perdiendo clientes ahora mismo sin darte cuenta.",
    );
    await expectTextRoute(
      baseUrl,
      "/restaurants",
      "Estás perdiendo clientes ahora mismo sin darte cuenta.",
    );
    await expectTextRoute(
      baseUrl,
      "/real-estate",
      "Estás perdiendo clientes ahora mismo sin darte cuenta.",
    );
    await expectTextRoute(
      baseUrl,
      "/ecommerce",
      "Estás perdiendo clientes ahora mismo sin darte cuenta.",
    );
    await expectTextRoute(
      baseUrl,
      "/agencies",
      "Estás perdiendo clientes ahora mismo sin darte cuenta.",
    );
    await expectTextRoute(baseUrl, "/login", "Accede a tu CRM de automatización.");
    await expectTextRoute(baseUrl, "/terminos", "Términos de Servicio");
    await expectTextRoute(baseUrl, "/privacidad", "Política de Privacidad");
    await expectTextRoute(baseUrl, "/reembolsos", "Política de Reembolsos");
    await expectTextRoute(baseUrl, "/precios", "Starter");
    await expectOkRoute(baseUrl, "/favicon.svg", "image/svg+xml");
    const faviconHead = await fetch(`${baseUrl}/favicon.svg`, { method: "HEAD" });
    assert(faviconHead.ok, "HEAD /favicon.svg must return 200.");
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
    } else {
      assert(
        landingHtml.includes("/apps/web/src/main.js"),
        "Development landing must reference source modules.",
      );
    }

    const admin = await fetch(`${baseUrl}/admin.html`, { redirect: "manual" });
    assert(admin.status === 302, "Protected admin route must redirect.");
    assert(admin.headers.get("location") === "/login", "Admin redirect must target /login.");

    const dashboard = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    assert(dashboard.status === 302, "Protected dashboard route must redirect.");
    assert(
      dashboard.headers.get("location") === "/login",
      "Dashboard redirect must target /login.",
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
