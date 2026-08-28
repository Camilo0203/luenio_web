import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { CleanupVerificationError, stopTestProcess, testProcessOptions } from "./test-process.mjs";

const isolatedTestEnv = {
  LUENIO_SKIP_ENV_FILE: "true",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  REQUIRE_SUPABASE: "false",
  DATABASE_URL: "",
  NEON_DATABASE_URL: "",
  LUENIO_WEBHOOK_URL: "",
  LUENIO_CRM_WEBHOOK_URL: "",
  LUENIO_WHATSAPP_WEBHOOK_URL: "",
  LUENIO_EMAIL_WEBHOOK_URL: "",
  CONTACT_WEBHOOK_URL: "",
  CONTACT_WEBHOOK_TOKEN: "",
  INVITATION_WEBHOOK_URL: "",
  INVITATION_WEBHOOK_TOKEN: "",
  AUTH_MFA_WEBHOOK_URL: "",
  AUTH_MFA_WEBHOOK_TOKEN: "",
  AUTOMATION_WEBHOOK_TOKEN: "",
  TURNSTILE_REQUIRED: "false",
  TURNSTILE_SITE_KEY: "",
  TURNSTILE_SECRET_KEY: "",
  ADMIN_MFA_REQUIRED: "false",
  ENABLE_PUBLIC_BILLING: "false",
  CONTACT_DELIVERY_WORKER_ENABLED: "false",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "whsec_luenio_local_test_secret",
  STRIPE_STARTER_PRICE_ID: "",
  STRIPE_PRO_PRICE_ID: "",
  STRIPE_AGENCY_PRICE_ID: "",
};

const npmCliPath = process.env.npm_execpath || null;

async function run(command, args, options = {}) {
  const cleanupFailureFile = path.join(
    process.cwd(),
    "test-results",
    `.cleanup-failure-${process.pid}-${Date.now()}`,
  );
  fs.mkdirSync(path.dirname(cleanupFailureFile), { recursive: true });
  fs.rmSync(cleanupFailureFile, { force: true });
  const child = spawn(
    command,
    args,
    testProcessOptions({
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...isolatedTestEnv,
        LUENIO_CLEANUP_FAILURE_FILE: cleanupFailureFile,
        ...(options.env || {}),
      },
      stdio: options.stdio || "inherit",
      windowsHide: true,
    }),
  );
  const timeoutMs = options.timeoutMs || 4 * 60_000;
  let timeout;
  const outcome = await Promise.race([
    new Promise((resolve) => {
      child.once("error", (error) => resolve({ error }));
      child.once("close", (code) => resolve({ code }));
    }),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    }),
  ]);
  clearTimeout(timeout);

  if (fs.existsSync(cleanupFailureFile)) {
    const cleanupMessage = fs.readFileSync(cleanupFailureFile, "utf8");
    fs.rmSync(cleanupFailureFile, { force: true });
    throw new CleanupVerificationError(cleanupMessage);
  }
  fs.rmSync(cleanupFailureFile, { force: true });

  if (outcome.timedOut) {
    await stopTestProcess(child, { label: `${command} ${args.join(" ")}`, timeoutMs: 3_000 });
    throw new Error(`${command} ${args.join(" ")} exceeded ${Math.round(timeoutMs / 1000)}s.`);
  }
  if (outcome.error) throw outcome.error;
  if (outcome.code !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${outcome.code}.`);
  }
}

function runNpmScript(scriptName, options = {}) {
  if (npmCliPath) {
    return run(process.execPath, [npmCliPath, "run", scriptName], options);
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npmCommand, ["run", scriptName], options);
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
      // Keep polling until the server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function runE2EWithServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const e2eHealthcheckToken = "luenio-e2e-healthcheck-token-at-least-32-chars";
  const server = spawn(
    process.execPath,
    ["server.js"],
    testProcessOptions({
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...isolatedTestEnv,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(port),
        HEALTHCHECK_TOKEN: e2eHealthcheckToken,
        ENABLE_PUBLIC_BILLING: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitForServer(baseUrl);
    await runNpmScript("test:e2e", {
      env: {
        E2E_BASE_URL: baseUrl,
        HEALTHCHECK_TOKEN: e2eHealthcheckToken,
        ENABLE_PUBLIC_BILLING: "true",
      },
    });
  } catch (error) {
    error.message = `${error.message}\n\nServer output:\n${output || "(no output)"}`;
    throw error;
  } finally {
    await stopTestProcess(server, { label: "production gate E2E server" });
  }
}

const steps = [
  ["Build", () => runNpmScript("build")],
  ["Runner process-tree cleanup", () => runNpmScript("test:runner-cleanup")],
  ["Storage fixture isolation", () => runNpmScript("test:storage-fixture")],
  ["UI performance budgets", () => runNpmScript("test:performance", { timeoutMs: 10 * 60_000 })],
  ["Architecture boundaries", () => runNpmScript("test:architecture")],
  ["API error boundary", () => runNpmScript("test:api-errors")],
  ["Automation privacy", () => runNpmScript("test:automation")],
  ["Auth security", () => runNpmScript("test:auth")],
  ["Billing checkout guard", () => runNpmScript("test:billing")],
  ["Contact public response privacy", () => runNpmScript("test:contact")],
  ["Core trust boundary", () => runNpmScript("test:core")],
  ["Work queue and digest", () => runNpmScript("test:work-queue")],
  ["CRM bulk and import", () => runNpmScript("test:crm-bulk")],
  ["CRM reports", () => runNpmScript("test:crm-reports")],
  ["Data hygiene", () => runNpmScript("test:data")],
  ["Production readiness", () => runNpmScript("test:readiness")],
  ["Shared VPS deployment configuration", () => runNpmScript("test:deployment")],
  ["Public-only launch mode", () => runNpmScript("test:public-only")],
  ["Development port fallback", () => runNpmScript("test:dev-port")],
  ["Industry demo system", () => runNpmScript("test:demo-system")],
  ["Niche landing conversion pages", () => runNpmScript("test:niche-landings")],
  ["Endpoint rate limits", () => runNpmScript("test:rate-limit")],
  ["Sellable SaaS product experience", () => runNpmScript("test:sellable")],
  ["Supabase schema", () => runNpmScript("test:schema")],
  ["Strict storage guard", () => runNpmScript("test:strict-storage")],
  ["Stripe webhook guard", () => runNpmScript("test:stripe-webhook")],
  ["Server smoke", () => runNpmScript("test:smoke")],
  ["Storage boundary", () => runNpmScript("test:storage")],
  ["Production server smoke", () => runNpmScript("test:smoke:prod")],
  ["Full SaaS E2E", runE2EWithServer],
  ["UI hardening", () => runNpmScript("test:ui-hardening")],
  ["Browser E2E + a11y", () => runNpmScript("test:browser", { timeoutMs: 8 * 60_000 })],
  ["Responsive matrix", () => runNpmScript("test:responsive")],
  ["Visual regression", () => runNpmScript("test:visual")],
  ["Light/dark theme audit", () => runNpmScript("test:theme")],
];

const results = [];
let hasFailure = false;

for (const [label, step] of steps) {
  console.info(`\n[production-gate] ${label}`);
  const startedAt = Date.now();
  try {
    await step();
    results.push({ label, status: "passed", error: null, durationMs: Date.now() - startedAt });
  } catch (error) {
    hasFailure = true;
    results.push({ label, status: "failed", error, durationMs: Date.now() - startedAt });
    console.error(`[production-gate] ${label} failed: ${error.message}`);
    if (error instanceof CleanupVerificationError) {
      console.error("[production-gate] Aborting: test isolation could not be restored.");
      break;
    }
  }
}

console.info("\n[production-gate] Summary");
console.info("-".repeat(72));
for (const result of results) {
  const statusLabel = result.status === "passed" ? "PASS" : "FAIL";
  const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
  console.info(`${statusLabel.padEnd(6)} ${duration.padStart(8)}  ${result.label}`);
  if (result.status === "failed" && result.error) {
    console.info(`         -> ${result.error.message}`);
  }
}
console.info("-".repeat(72));
console.info(
  `${results.filter((r) => r.status === "passed").length}/${results.length} steps passed`,
);

if (hasFailure) {
  console.error("\nProduction gate FAILED");
  process.exitCode = 1;
} else {
  console.info("\nProduction gate passed");
}
