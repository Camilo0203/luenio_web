import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stopTestProcess, testProcessOptions } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";
import { SECTORS, demoPath, nichePath } from "../config/sectors.js";
import {
  assert,
  compareImages,
  createLocalRequestFilter,
  defaultContextOptions,
  launchBrowser,
  maxDiffRatio,
} from "./visual-regression-shared.mjs";

const UPDATE_BASELINES = process.argv.includes("--update");
const scenarioArg = process.argv.find((argument) => argument.startsWith("--scenario="));
const requestedScenario = scenarioArg?.slice("--scenario=".length).trim() || null;
const baselineDir = path.join(process.cwd(), "tests", "visual-baselines");
const finalResultsDir = path.join(process.cwd(), "test-results", "visual");
const resultsDir = path.join(process.cwd(), "test-results", `.visual-${process.pid}`);
const fixtureDir = path.join(process.cwd(), "test-results", `.visual-fixture-${process.pid}`);
const localDbPath = path.join(fixtureDir, "leads-db.json");
const workerScriptPath = path.join(process.cwd(), "scripts", "visual-capture-worker.mjs");
// Twice in CI, headless Chromium wedged its DevTools pipe indefinitely after
// ~12 sequential pages on the same browser context -- not a slow render, a
// stall that blocks the whole Node event loop, so a same-process timeout
// (e.g. Promise.race with setTimeout) never fires either: the timer itself
// can't run. Each scenario now captures in its own child process, supervised
// from here with a real OS-level timeout+kill, so a stall costs seconds
// instead of the whole step's budget regardless of what's blocked inside it.
const captureTimeoutMs = 45_000;

// Scenario names key the baseline PNGs in tests/visual-baselines, so they stay
// the sector id; only the list itself is derived.
const publicSurfaceScenarios = [
  ["catalog", "/demos"],
  ...SECTORS.map((sector) => [sector.id, nichePath(sector)]),
  ...SECTORS.map((sector) => [`simulation-${sector.id}`, demoPath(sector)]),
].flatMap(([name, route]) => [
  { name: `${name}-light-desktop`, path: route, theme: "light", width: 1280, height: 800 },
  { name: `${name}-dark-mobile`, path: route, theme: "dark", width: 390, height: 844 },
]);

const scenarios = [
  { name: "home-light-desktop", path: "/", theme: "light", width: 1280, height: 800 },
  { name: "home-dark-mobile", path: "/", theme: "dark", width: 390, height: 844 },
  ...publicSurfaceScenarios,
  // The 404 is a real page a visitor can land on, so it gets the same coverage.
  {
    name: "notfound-light-desktop",
    path: "/pagina-inexistente-para-regresion-visual",
    theme: "light",
    width: 1280,
    height: 800,
  },
  {
    name: "notfound-dark-mobile",
    path: "/pagina-inexistente-para-regresion-visual",
    theme: "dark",
    width: 390,
    height: 844,
  },
  {
    name: "quote-light-desktop",
    path: "/cotizacion?sector=agencia&demo=Impulso+Digital&service=Página+web+a+medida&source=visual_test",
    theme: "light",
    width: 1280,
    height: 800,
  },
  {
    name: "quote-dark-mobile",
    path: "/cotizacion?sector=agencia&demo=Impulso+Digital&service=Página+web+a+medida&source=visual_test",
    theme: "dark",
    width: 390,
    height: 844,
  },
  { name: "login-light-desktop", path: "/login", theme: "light", width: 1280, height: 800 },
  { name: "login-light-mobile", path: "/login", theme: "light", width: 390, height: 844 },
  {
    name: "workspace-hub-light-desktop",
    path: "/app",
    theme: "light",
    width: 1280,
    height: 800,
    authenticated: true,
  },
  {
    name: "workspace-hub-light-mobile",
    path: "/app",
    theme: "light",
    width: 390,
    height: 844,
    authenticated: true,
  },
  {
    name: "dashboard-light-desktop",
    path: "/dashboard",
    theme: "light",
    width: 1280,
    height: 800,
    authenticated: true,
  },
  {
    name: "dashboard-light-mobile",
    path: "/dashboard",
    theme: "light",
    width: 390,
    height: 844,
    authenticated: true,
  },
  {
    name: "crm-dark-desktop",
    path: "/crm",
    theme: "dark",
    width: 1280,
    height: 800,
    authenticated: true,
  },
  {
    name: "crm-dark-mobile",
    path: "/crm",
    theme: "dark",
    width: 390,
    height: 844,
    authenticated: true,
  },
];

const selectedScenarios = requestedScenario
  ? scenarios.filter((scenario) => scenario.name === requestedScenario)
  : scenarios;

if (requestedScenario && selectedScenarios.length === 0) {
  throw new Error(
    `Unknown visual scenario "${requestedScenario}". Available scenarios: ${scenarios
      .map((scenario) => scenario.name)
      .join(", ")}`,
  );
}

async function startServer() {
  const port = await getFreePort();
  fs.mkdirSync(fixtureDir, { recursive: true });
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    ["server.js"],
    testProcessOptions({
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        NODE_ENV: "test",
        ENABLE_AGENCY_CRM: "true",
        LUENIO_SKIP_ENV_FILE: "true",
        REQUIRE_SUPABASE: "false",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        DATABASE_URL: "",
        NEON_DATABASE_URL: "",
        CONTACT_WEBHOOK_URL: "",
        CONTACT_FALLBACK_WEBHOOK_URL: "",
        TURNSTILE_REQUIRED: "false",
        ADMIN_MFA_REQUIRED: "false",
        CONTACT_DELIVERY_WORKER_ENABLED: "false",
        LUENIO_LOCAL_DB_PATH: localDbPath,
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
  } catch (error) {
    await stopTestProcess(server, { label: "visual test server" });
    throw new Error(`${error.message}\n\nServer output:\n${output || "(no output)"}`);
  }

  return {
    baseUrl,
    stop: () => stopTestProcess(server, { label: "visual test server" }),
  };
}

function seedInvitation(email) {
  const database = fs.existsSync(localDbPath)
    ? JSON.parse(fs.readFileSync(localDbPath, "utf8"))
    : {};
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const invitation = {
    id: `invite_visual_${crypto.randomBytes(8).toString("hex")}`,
    email,
    businessId: `business_visual_${crypto.randomBytes(8).toString("hex")}`,
    businessName: "Luenio Visual Workspace",
    role: "client",
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    status: "pending",
    expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    invitedBy: "visual_regression",
    createdAt: now.toISOString(),
  };
  fs.writeFileSync(
    localDbPath,
    JSON.stringify(
      {
        ...database,
        invitations: [invitation, ...(database.invitations || [])],
        updatedAt: now.toISOString(),
      },
      null,
      2,
    ),
  );
  return token;
}

function seedVisualLeads(userId) {
  const database = JSON.parse(fs.readFileSync(localDbPath, "utf8"));
  const timestamp = "2026-07-27T14:30:00.000Z";
  const leads = [
    {
      id: "lead_visual_agency",
      userId,
      name: "Laura Gómez",
      business: "Impulso Digital",
      phone: "+573001234567",
      email: "laura@example.com",
      service: "Página web a medida",
      message: "Necesitamos mejorar captación y seguimiento comercial.",
      source: "visual_regression",
      score: 92,
      classification: "hot",
      status: "qualified",
      pipelineStage: "qualified",
      scoreReasons: ["alta intención"],
      timestamp,
      updatedAt: timestamp,
      nextAction: "Preparar propuesta",
      tags: ["agencia", "prioritario"],
    },
    {
      id: "lead_visual_store",
      userId,
      name: "Mateo Ruiz",
      business: "NovaStore",
      phone: "+573109876543",
      email: "mateo@example.com",
      service: "Automatización de WhatsApp",
      message: "Queremos responder consultas y recuperar oportunidades.",
      source: "visual_regression",
      score: 68,
      classification: "warm",
      status: "contacted",
      pipelineStage: "contacted",
      scoreReasons: ["seguimiento"],
      timestamp: "2026-07-27T13:15:00.000Z",
      updatedAt: timestamp,
      nextAction: "Agendar diagnóstico",
      tags: ["ecommerce"],
    },
  ];
  fs.writeFileSync(
    localDbPath,
    JSON.stringify(
      {
        ...database,
        leads: [...leads, ...(database.leads || []).filter((lead) => lead.userId !== userId)],
        updatedAt: timestamp,
      },
      null,
      2,
    ),
  );
}

async function authenticateContext(context, baseUrl) {
  const email = `visual-${Date.now()}@luenio.test`;
  const token = seedInvitation(email);
  const response = await context.request.post(`${baseUrl}/api/invitations/accept`, {
    data: { token, password: "visual-test-password-123" },
  });
  assert(response.ok(), `Visual user invitation failed with ${response.status()}.`);
  const body = await response.json();
  assert(body.user?.id, "Visual user invitation did not return a user.");
  assert(body.user?.businessId, "Visual user invitation did not return a business scope.");
  seedVisualLeads(body.user.businessId);
}

async function createAuthStorageState(baseUrl) {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext(defaultContextOptions);
    await context.route("**/*", createLocalRequestFilter(baseUrl));
    await authenticateContext(context, baseUrl);
    const storageStatePath = path.join(fixtureDir, "auth-storage-state.json");
    await context.storageState({ path: storageStatePath });
    return storageStatePath;
  } finally {
    await browser.close();
  }
}

/** Runs one scenario capture in its own child process, killing and reporting
 * a timeout instead of ever blocking this process's own event loop. */
async function captureScenario(scenario, baseUrl, actualPath, storageStatePath) {
  const configPath = path.join(
    fixtureDir,
    `capture-${scenario.name}-${process.hrtime.bigint()}.json`,
  );
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      scenario,
      baseUrl,
      actualPath,
      storageStatePath: scenario.authenticated ? storageStatePath : null,
    }),
  );
  const child = spawn(
    process.execPath,
    [workerScriptPath, configPath],
    testProcessOptions({
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );
  let stderr = "";
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  let timer;
  try {
    const outcome = await Promise.race([
      new Promise((resolve) => {
        child.once("error", (error) => resolve({ error }));
        child.once("close", (code) => resolve({ code }));
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), captureTimeoutMs);
      }),
    ]);
    if (outcome.timedOut) {
      await stopTestProcess(child, { label: `${scenario.name} capture`, timeoutMs: 3_000 }).catch(
        () => {},
      );
      throw new Error(`stalled and was killed after ${Math.round(captureTimeoutMs / 1000)}s`);
    }
    if (outcome.error) throw outcome.error;
    if (outcome.code !== 0) {
      throw new Error(stderr.trim() || `capture worker exited with code ${outcome.code}`);
    }
  } finally {
    clearTimeout(timer);
    fs.rmSync(configPath, { force: true });
  }
}

async function run() {
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  let server;
  try {
    server = await startServer();
    const storageStatePath = selectedScenarios.some((scenario) => scenario.authenticated)
      ? await createAuthStorageState(server.baseUrl)
      : null;

    // Collect every scenario's outcome instead of throwing on the first
    // failure: a single stale-baseline drift (e.g. a Chromium version bump)
    // can affect several scenarios, and finding them one CI run at a time
    // is far more expensive than reporting them all together up front.
    const failures = [];
    for (const scenario of selectedScenarios) {
      console.info(`[visual] capture: ${scenario.name}`);
      const actualPath = path.join(resultsDir, `${scenario.name}.png`);
      const baselinePath = path.join(baselineDir, `${scenario.name}.png`);
      const diffPath = path.join(resultsDir, `${scenario.name}.diff.png`);

      try {
        await captureScenario(scenario, server.baseUrl, actualPath, storageStatePath);
      } catch (error) {
        failures.push(`${scenario.name}: ${error.message}`);
        console.error(`[visual] FAILED: ${scenario.name}: ${error.message}`);
        continue;
      }

      if (UPDATE_BASELINES) {
        fs.copyFileSync(actualPath, baselinePath);
        console.info(`[visual] baseline updated: ${scenario.name}`);
        continue;
      }

      try {
        assert(
          fs.existsSync(baselinePath),
          `Missing visual baseline ${scenario.name}. Run: npm run test:visual:update`,
        );
        let diffRatio = await compareImages(actualPath, baselinePath, diffPath);
        // Only worth retrying for a plausible decode/paint race close to the
        // threshold -- a large diff is a genuine mismatch no amount of
        // re-capturing will fix.
        if (diffRatio > maxDiffRatio && diffRatio <= maxDiffRatio * 5) {
          await captureScenario(scenario, server.baseUrl, actualPath, storageStatePath);
          diffRatio = await compareImages(actualPath, baselinePath, diffPath);
        }
        if (diffRatio <= maxDiffRatio && fs.existsSync(diffPath)) fs.unlinkSync(diffPath);
        assert(
          diffRatio <= maxDiffRatio,
          `${scenario.name} changed ${(diffRatio * 100).toFixed(2)}% ` +
            `(allowed ${(maxDiffRatio * 100).toFixed(2)}%). See ${diffPath}.`,
        );
        console.info(`[visual] ok: ${scenario.name} (${(diffRatio * 100).toFixed(3)}%)`);
      } catch (error) {
        failures.push(`${scenario.name}: ${error.message}`);
        console.error(`[visual] FAILED: ${scenario.name}: ${error.message}`);
      }
    }
    assert(
      failures.length === 0,
      `${failures.length} visual regression scenario(s) failed:\n${failures.join("\n")}`,
    );
  } finally {
    await server?.stop();
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    // Keep whatever screenshots/diffs were captured even when a scenario threw --
    // that diff.png is what the failure message points at, and CI's diagnostics
    // upload only ever sees finalResultsDir, never the pid-scoped temp dir.
    fs.rmSync(finalResultsDir, { recursive: true, force: true });
    fs.renameSync(resultsDir, finalResultsDir);
  }

  console.info(
    UPDATE_BASELINES
      ? `[visual] ${selectedScenarios.length} baselines updated.`
      : `[visual] ${selectedScenarios.length} visual regression checks passed.`,
  );
}

await run();
