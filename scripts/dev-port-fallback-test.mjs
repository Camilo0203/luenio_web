import { spawn } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";

/** Minimal host env so Windows/Linux child processes can start Node. */
function baseProcessEnv() {
  const keep = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "COMSPEC",
    "ComSpec",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
    "OS",
    "LANG",
    "LC_ALL",
  ];
  const env = {};
  for (const key of keep) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

/**
 * Full env that passes assertSecureProductionRuntime() in server.js so the
 * production child actually reaches the listen() path (and then fails on EADDRINUSE).
 */
function productionPortTestEnv(overrides = {}) {
  return {
    ...baseProcessEnv(),
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    APP_URL: "https://luenio.com",
    ALLOWED_HOSTS: "luenio.com",
    REQUIRE_TRUSTED_PROXY: "true",
    TRUSTED_PROXY_SECRET: "port-test-proxy-secret-at-least-32-chars!",
    HEALTHCHECK_TOKEN: "port-test-health-token-at-least-32-chars!",
    AUTH_SECRET: "port-test-auth-secret-at-least-32-chars!!",
    REQUIRE_SUPABASE: "true",
    SUPABASE_URL: "https://port-test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "port-test-service-role-key-32chars-min",
    TURNSTILE_REQUIRED: "true",
    TURNSTILE_SITE_KEY: "port-test-site-key",
    TURNSTILE_SECRET_KEY: "port-test-secret-key",
    TURNSTILE_ALLOWED_HOSTNAMES: "luenio.com",
    CONTACT_WEBHOOK_URL: "https://automation.luenio.com/webhook/port-test-contact",
    CONTACT_WEBHOOK_TOKEN: "port-test-contact-token-at-least-32-chars",
    CONTACT_DELIVERY_WORKER_ENABLED: "true",
    CONTACT_DELIVERY_WORKER_INTERVAL_MS: "30000",
    CONTACT_DELIVERY_WORKER_BATCH_SIZE: "10",
    INVITATION_WEBHOOK_URL: "https://automation.luenio.com/webhook/port-test-invite",
    INVITATION_WEBHOOK_TOKEN: "port-test-invite-token-at-least-32-chars!",
    ADMIN_MFA_REQUIRED: "true",
    AUTH_MFA_WEBHOOK_URL: "https://automation.luenio.com/webhook/port-test-mfa",
    AUTH_MFA_WEBHOOK_TOKEN: "port-test-mfa-token-at-least-32-characters!",
    ENABLE_PUBLIC_BILLING: "false",
    MAX_BODY_BYTES: "64000",
    RATE_LIMIT_MAX: "120",
    SENSITIVE_RATE_LIMIT_MAX: "30",
    SESSION_TTL_SECONDS: "86400",
    PASSWORD_MIN_LENGTH: "12",
    AUTH_MAX_FAILURES: "5",
    SERVE_DIST: "false",
    ...overrides,
  };
}

function developmentTestEnv(overrides = {}) {
  return {
    ...baseProcessEnv(),
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    COOKIE_SECURE: "false",
    APP_URL: "http://127.0.0.1:4180",
    ALLOWED_HOSTS: "127.0.0.1,localhost",
    REQUIRE_SUPABASE: "false",
    REQUIRE_TRUSTED_PROXY: "false",
    TURNSTILE_REQUIRED: "false",
    ADMIN_MFA_REQUIRED: "false",
    ENABLE_PUBLIC_BILLING: "false",
    CONTACT_DELIVERY_WORKER_ENABLED: "false",
    AUTH_SECRET: "dev-port-test-auth-secret-at-least-32",
    HEALTHCHECK_TOKEN: "dev-port-test-health-token-32chars",
    ...overrides,
  };
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("reserved");
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function waitForServer(child, { expectExit = false } = {}) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for server output. Output:\n${output}`));
    }, 15_000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
    }

    function onData(chunk) {
      output += chunk.toString();
      const match = output.match(/Full SaaS server running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && !expectExit) {
        cleanup();
        resolve({ output, port: Number(match[1]) });
      }
    }

    function onExit(code) {
      if (expectExit) {
        cleanup();
        resolve({ output, code });
        return;
      }
      cleanup();
      reject(new Error(`Server exited early with code ${code}. Output:\n${output}`));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

function spawnServer(env) {
  return spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function fetchHealth(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
}

async function testDevelopmentFallback() {
  const reserved = await reservePort();
  const child = spawnServer(
    developmentTestEnv({
      PORT: String(reserved.port),
    }),
  );

  try {
    const result = await waitForServer(child);
    assert.notEqual(result.port, reserved.port, "development server should use a fallback port");
    assert.match(result.output, /Falling back to an available development port/);
    await fetchHealth(result.port);
  } finally {
    child.kill("SIGTERM");
    await closeServer(reserved.server);
  }
}

async function testProductionFailsOnOccupiedPort() {
  const reserved = await reservePort();
  const child = spawnServer(
    productionPortTestEnv({
      PORT: String(reserved.port),
    }),
  );

  try {
    const result = await waitForServer(child, { expectExit: true });
    assert.notEqual(result.code, 0, "production server must fail when configured port is occupied");
    assert.match(
      result.output,
      /Server failed to start|EADDRINUSE|EADDRNOTAVAIL|address already in use/i,
    );
  } finally {
    child.kill("SIGTERM");
    await closeServer(reserved.server);
  }
}

await testDevelopmentFallback();
await testProductionFailsOnOccupiedPort();

console.info("Development port fallback test passed.");
