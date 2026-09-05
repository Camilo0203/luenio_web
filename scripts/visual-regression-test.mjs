import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { stopTestProcess, testProcessOptions } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";
import { SECTORS, demoPath, nichePath } from "../config/sectors.js";

const UPDATE_BASELINES = process.argv.includes("--update");
const scenarioArg = process.argv.find((argument) => argument.startsWith("--scenario="));
const requestedScenario = scenarioArg?.slice("--scenario=".length).trim() || null;
const baselineDir = path.join(process.cwd(), "tests", "visual-baselines");
const finalResultsDir = path.join(process.cwd(), "test-results", "visual");
const resultsDir = path.join(process.cwd(), "test-results", `.visual-${process.pid}`);
const fixtureDir = path.join(process.cwd(), "test-results", `.visual-fixture-${process.pid}`);
const localDbPath = path.join(fixtureDir, "leads-db.json");
const maxDiffRatio = 0.005;
// Chromium and system Chrome rasterize scaled AVIF text edges slightly differently.
// Keep geometry strict (0.5% of pixels) while ignoring imperceptible edge antialiasing.
const channelTolerance = 48;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    for (const channel of ["chrome", "msedge"]) {
      try {
        const browser = await chromium.launch({ headless: true, channel });
        console.info(`[visual] Using system browser channel: ${channel}`);
        return browser;
      } catch {
        // Try the next installed browser.
      }
    }
    throw new Error(`No Playwright browser available: ${bundledError.message}`);
  }
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

async function preparePage(page, scenario, baseUrl) {
  page.setDefaultNavigationTimeout(15_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: scenario.width, height: scenario.height });
  await page.addInitScript((theme) => {
    globalThis.localStorage.setItem("luenio-theme", theme);
  }, scenario.theme);
  await page.goto(`${baseUrl}${scenario.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  if (scenario.path === "/login") {
    await page.locator(".luenio-guard__tile").first().waitFor({ state: "visible", timeout: 8_000 });
    await page.evaluate(() => {
      const labels = ["Meta", "Proceso", "Cliente", "Acuerdo"];
      const prompt = globalThis.document.querySelector(".luenio-guard__prompt");
      if (prompt) prompt.textContent = "Haz clic en: Meta";
      globalThis.document.querySelectorAll(".luenio-guard__tile").forEach((tile, index) => {
        const [symbol, label] = tile.querySelectorAll("span");
        if (symbol) symbol.textContent = ["◆", "●", "■", "▲"][index] || "●";
        if (label) label.textContent = labels[index] || `Opción ${index + 1}`;
      });
    });
  }
  if (scenario.path === "/dashboard") {
    await page.waitForFunction(
      () => {
        const account = globalThis.document.querySelector("#adminUser strong");
        const leads = globalThis.document.querySelectorAll(".lead-row");
        return (
          !globalThis.document.body.classList.contains("admin-loading") &&
          account &&
          !account.textContent?.includes("Verificando") &&
          leads.length >= 2
        );
      },
      undefined,
      { timeout: 15_000 },
    );
  }
  if (scenario.path === "/app") {
    await page.locator(".hub-card--accent").waitFor({ state: "visible", timeout: 15_000 });
  }
  if (scenario.path === "/crm") {
    await page.locator(".crm-shell .ui-empty").waitFor({ state: "visible", timeout: 15_000 });
  }
  if (scenario.path === "/") {
    // home-clarity.js sets the hero demo shot's src lazily and toggles this
    // attribute off only once that image has loaded and decoded; screenshotting
    // before then captures whatever the shot's untouched default markup looks
    // like, not the picked demo, producing a large false diff (11.85% on
    // home-light-desktop in CI, where nothing is cached ahead of time).
    await page.waitForFunction(
      () =>
        !globalThis.document
          .querySelector("[data-hero-stage] .hc-browser")
          ?.hasAttribute("aria-busy"),
      undefined,
      { timeout: 15_000 },
    );
  }
  await page.evaluate(async () => {
    const settle = (promise, timeoutMs = 5_000) =>
      Promise.race([
        Promise.resolve(promise).catch(() => {}),
        new Promise((resolve) => globalThis.setTimeout(resolve, timeoutMs)),
      ]);
    await settle(globalThis.document.fonts?.ready);
    await settle(
      Promise.all(
        [...globalThis.document.images].map((image) =>
          typeof image.decode === "function"
            ? image.decode().catch(() => {})
            : image.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  image.addEventListener("load", resolve, { once: true });
                  image.addEventListener("error", resolve, { once: true });
                }),
        ),
      ),
    );
    await new Promise((resolve) =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
    );
  });
}

async function compareImages(actualPath, baselinePath, diffPath) {
  const baseline = sharp(baselinePath);
  const actual = sharp(actualPath);
  const [baselineMetadata, actualMetadata] = await Promise.all([
    baseline.metadata(),
    actual.metadata(),
  ]);
  assert(
    baselineMetadata.width === actualMetadata.width &&
      baselineMetadata.height === actualMetadata.height,
    `Visual dimensions changed for ${path.basename(actualPath)}: ` +
      `${baselineMetadata.width}x${baselineMetadata.height} -> ` +
      `${actualMetadata.width}x${actualMetadata.height}.`,
  );

  const [baselineRaw, actualRaw] = await Promise.all([
    baseline.ensureAlpha().raw().toBuffer(),
    actual.ensureAlpha().raw().toBuffer(),
  ]);
  const diffRaw = Buffer.alloc(actualRaw.length);
  let differentPixels = 0;

  for (let offset = 0; offset < actualRaw.length; offset += 4) {
    const redDiff = Math.abs(actualRaw[offset] - baselineRaw[offset]);
    const greenDiff = Math.abs(actualRaw[offset + 1] - baselineRaw[offset + 1]);
    const blueDiff = Math.abs(actualRaw[offset + 2] - baselineRaw[offset + 2]);
    const different =
      redDiff > channelTolerance || greenDiff > channelTolerance || blueDiff > channelTolerance;
    if (different) differentPixels += 1;
    diffRaw[offset] = different ? 255 : Math.round(actualRaw[offset] * 0.18);
    diffRaw[offset + 1] = different ? 32 : Math.round(actualRaw[offset + 1] * 0.18);
    diffRaw[offset + 2] = different ? 64 : Math.round(actualRaw[offset + 2] * 0.18);
    diffRaw[offset + 3] = 255;
  }

  const totalPixels = baselineMetadata.width * baselineMetadata.height;
  const ratio = differentPixels / totalPixels;
  if (ratio > maxDiffRatio) {
    await sharp(diffRaw, {
      raw: {
        width: baselineMetadata.width,
        height: baselineMetadata.height,
        channels: 4,
      },
    })
      .png()
      .toFile(diffPath);
  }
  return ratio;
}

async function run() {
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  let server;
  let browser;
  let publicContext;
  let authenticatedContext;
  try {
    server = await startServer();
    browser = await launchBrowser();
    const contextOptions = {
      locale: "es-CO",
      reducedMotion: "reduce",
      serviceWorkers: "block",
    };
    publicContext = await browser.newContext(contextOptions);
    authenticatedContext = await browser.newContext(contextOptions);
    const keepLocalRequests = async (route) => {
      if (route.request().url().startsWith(server.baseUrl)) {
        await route.continue();
        return;
      }
      await route.abort();
    };
    await publicContext.route("**/*", keepLocalRequests);
    await authenticatedContext.route("**/*", keepLocalRequests);
    await authenticateContext(authenticatedContext, server.baseUrl);
    // Collect every scenario's outcome instead of throwing on the first
    // failure: a single stale-baseline drift (e.g. a Chromium version bump)
    // can affect several scenarios, and finding them one CI run at a time
    // is far more expensive than reporting them all together up front.
    const failures = [];
    for (const scenario of selectedScenarios) {
      console.info(`[visual] capture: ${scenario.name}`);
      const context = scenario.authenticated ? authenticatedContext : publicContext;
      const page = await context.newPage();
      const actualPath = path.join(resultsDir, `${scenario.name}.png`);
      const baselinePath = path.join(baselineDir, `${scenario.name}.png`);
      const diffPath = path.join(resultsDir, `${scenario.name}.diff.png`);
      try {
        await preparePage(page, scenario, server.baseUrl);
        await page.screenshot({
          path: actualPath,
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          scale: "css",
        });

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
          // re-settling will fix, and headless Chromium's requestAnimationFrame
          // can be throttled to a crawl in CI, so nested rAFs here previously
          // turned every real failure into a ~60s stall instead of a fast one.
          if (diffRatio > maxDiffRatio && diffRatio <= maxDiffRatio * 5) {
            await page.evaluate(async () => {
              await Promise.all(
                [...globalThis.document.images].map((image) => image.decode?.().catch(() => {})),
              );
            });
            await page.waitForTimeout(150);
            await page.screenshot({
              path: actualPath,
              animations: "disabled",
              caret: "hide",
              fullPage: false,
              scale: "css",
            });
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
      } finally {
        await page.close();
      }
    }
    assert(
      failures.length === 0,
      `${failures.length} visual regression scenario(s) failed:\n${failures.join("\n")}`,
    );
  } finally {
    await publicContext?.close();
    await authenticatedContext?.close();
    await browser?.close();
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
