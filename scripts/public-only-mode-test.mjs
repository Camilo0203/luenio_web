import { spawn } from "node:child_process";
import { stopTestProcess } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    LUENIO_SKIP_ENV_FILE: "true",
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: String(port),
    PUBLIC_DEMO_MODE: "true",
    ENABLE_AGENCY_CRM: "true",
    CRM_PUBLIC: "true",
    CRM_API_PUBLIC: "true",
    CONTACT_DELIVERY_WORKER_ENABLED: "false",
    DIGEST_CRON_ENABLED: "false",
    TURNSTILE_REQUIRED: "false",
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

try {
  await waitForServer(baseUrl, { child: server, label: "Public-only mode server" });

  for (const route of ["/", "/demos", "/cotizacion", "/agencias", "/privacidad"]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert(response.status === 200, `${route} must remain public (received ${response.status}).`);
  }

  const home = await (await fetch(`${baseUrl}/`)).text();
  assert(home.includes('id="nosotros"'), "Home must retain a visible Quiénes somos section.");
  assert(
    !/Acceso clientes|Mi espacio|data-client-access|client-access-boot/i.test(home),
    "Home must not expose client portal affordances.",
  );

  const clientRoutes = [
    "/login",
    "/aceptar-invitacion",
    "/restablecer-acceso",
    "/dashboard",
    "/app",
    "/crm",
    "/apps/admin/auth.html",
    "/apps/admin/src/admin.js",
  ];
  for (const route of clientRoutes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert(response.status === 302, `${route} must redirect while clients are disabled.`);
    assert(response.headers.get("location") === "/demos", `${route} must redirect to /demos.`);
    assert(response.headers.get("cache-control") === "no-store", `${route} must not be cached.`);
  }

  const clientApis = [
    "/api/auth",
    "/api/billing",
    "/api/stripe-webhook",
    "/api/leads",
    "/api/process",
    "/api/settings",
    "/api/invitations",
    "/api/password-reset/request",
    "/api/crm/health",
  ];
  for (const route of clientApis) {
    const response = await fetch(`${baseUrl}${route}`);
    assert(response.status === 404, `${route} must be unavailable while clients are disabled.`);
  }

  const publicConfig = await fetch(`${baseUrl}/api/public-config`);
  assert(publicConfig.ok, "Public configuration must remain available.");
  console.info("Public-only mode guard passed");
} catch (error) {
  error.message = `${error.message}\n\nServer output:\n${output || "(no output)"}`;
  throw error;
} finally {
  await stopTestProcess(server, { label: "public-only mode server" });
}
