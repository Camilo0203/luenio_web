/* global document, window, getComputedStyle */
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Keep polling until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("UI hardening server did not become ready.");
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    for (const channel of ["chrome", "msedge"]) {
      try {
        return await chromium.launch({ headless: true, channel });
      } catch {
        // Try the next installed browser.
      }
    }
  }
  throw new Error("No Playwright browser is available for UI hardening checks.");
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "test",
    ENABLE_AGENCY_CRM: "true",
    CRM_PUBLIC: "true",
    LUENIO_SKIP_ENV_FILE: "true",
    REQUIRE_SUPABASE: "false",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    DATABASE_URL: "",
    NEON_DATABASE_URL: "",
    CONTACT_WEBHOOK_URL: "",
    TURNSTILE_REQUIRED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
const serverClosed = new Promise((resolve) => server.once("close", resolve));

let browser;
try {
  await waitForServer(baseUrl);
  browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "es-CO",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  const longName = `FAST ✅ عميل 超長 ${"Empresa internacional ".repeat(8)}`.trim();
  await page.route("**/api/crm/clients?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    const delay = query === "slow" ? 700 : query === "fast" ? 20 : 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const name = query === "fast" ? longName : query === "slow" ? "STALE RESULT" : "BASE";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: query || "base",
            name,
            company: "株式会社 Luenio 🚀",
            email: "unicode+audit@example.com",
            status: "activo",
            owner_name: "فريق المبيعات",
            tags: ["重要", "emoji-✅"],
          },
        ],
        total: 1,
      }),
    });
  });

  await page.goto(`${baseUrl}/crm#/clientes`, { waitUntil: "domcontentloaded" });
  const search = page.getByRole("textbox", { name: "Buscar clientes" });
  await search.waitFor({ state: "visible", timeout: 10_000 });
  await search.fill("slow");
  await page.waitForTimeout(300);
  await search.fill("fast");
  await page.waitForTimeout(1_050);
  await page.getByText("FAST ✅", { exact: false }).waitFor({ state: "visible" });
  assert(
    (await page.getByText("STALE RESULT", { exact: false }).count()) === 0,
    "Stale search won.",
  );
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert(!overflows, "Long Unicode CRM data must not overflow the mobile viewport.");

  const mobileAdaptation = await page.evaluate(() => {
    const nav = document.querySelector(".crm-sidebar__nav");
    const navLink = document.querySelector(".crm-sidebar__link");
    const input = document.querySelector(".ui-input");
    const topbarButton = document.querySelector(".crm-topbar .ui-btn");
    const tableRow = document.querySelector(".data-table tbody tr");
    const navRect = nav?.getBoundingClientRect();
    return {
      navPosition: nav ? getComputedStyle(nav).position : "",
      navBottomGap: navRect ? Math.abs(window.innerHeight - navRect.bottom) : Infinity,
      navLinkHeight: navLink?.getBoundingClientRect().height || 0,
      inputHeight: input?.getBoundingClientRect().height || 0,
      topbarButtonHeight: topbarButton?.getBoundingClientRect().height || 0,
      tableRowDisplay: tableRow ? getComputedStyle(tableRow).display : "",
    };
  });
  assert(mobileAdaptation.navPosition === "fixed", "Mobile navigation must stay thumb-reachable.");
  assert(mobileAdaptation.navBottomGap <= 1, "Mobile navigation must respect the viewport bottom.");
  assert(mobileAdaptation.navLinkHeight >= 44, "Mobile navigation targets must be at least 44px.");
  assert(mobileAdaptation.inputHeight >= 44, "Touch inputs must be at least 44px.");
  assert(mobileAdaptation.topbarButtonHeight >= 44, "Touch actions must be at least 44px.");
  assert(
    mobileAdaptation.tableRowDisplay === "block",
    "Dense mobile tables must adapt into readable records.",
  );

  await page.setViewportSize({ width: 844, height: 390 });
  const tabletAdaptation = await page.evaluate(() => {
    const sidebar = document.querySelector(".crm-sidebar");
    const navLink = document.querySelector(".crm-sidebar__link");
    return {
      sidebarWidth: sidebar?.getBoundingClientRect().width || 0,
      navLinkHeight: navLink?.getBoundingClientRect().height || 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  assert(
    tabletAdaptation.sidebarWidth >= 60 && tabletAdaptation.sidebarWidth <= 68,
    "Tablet layout must use the compact navigation rail.",
  );
  assert(tabletAdaptation.navLinkHeight >= 44, "Tablet rail targets must remain touch-safe.");
  assert(!tabletAdaptation.overflow, "Tablet landscape must not overflow the viewport.");
  await page.setViewportSize({ width: 390, height: 844 });

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = axe.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  assert(
    blocking.length === 0,
    `CRM hardening view has blocking a11y issues: ${JSON.stringify(
      blocking.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
    )}`,
  );

  await page.evaluate(async () => {
    const {
      renderAgencyCommandCenter,
      renderInvoiceList,
      renderKanbanBoard,
      renderMetricsGrid,
      renderProjectTimeline,
    } = await import("/components/index.js");
    document.body.innerHTML = '<main id="component-adapt-sandbox"></main>';
    const sandbox = document.querySelector("#component-adapt-sandbox");
    sandbox.style.padding = "12px";
    sandbox.style.display = "grid";
    sandbox.style.gap = "12px";
    window.__adaptSelections = 0;
    const longText = `Cliente internacional العربية 超長 ${"sin cortes ".repeat(8)}`;

    sandbox.append(
      renderMetricsGrid({
        mrr: 12000,
        mrrDelta: 4.2,
        newMrr: 1800,
        churnedMrr: 300,
        activeClients: 18,
        activeProjects: 7,
        openPipeline: 62000,
        openInvoices: 7400,
        snapshots: Array.from({ length: 12 }, (_, index) => ({
          month: `2026-${String(index + 1).padStart(2, "0")}-01`,
          mrr: 1000 + index * 900,
        })),
      }),
      renderKanbanBoard({
        board: {
          nuevo: [
            {
              id: "touch-deal",
              name: longText,
              client_company: "Empresa móvil",
              value: 25000,
              probability: 60,
            },
          ],
        },
        onSelect: () => {
          window.__adaptSelections += 1;
        },
      }),
      renderInvoiceList({
        invoices: [
          {
            id: "invoice-1",
            number: "INV-2026-00001",
            client_company: longText,
            project_name: "Adaptación responsive",
            amount: 4800,
            currency: "USD",
            status: "enviada",
            issue_date: "2026-07-01",
            due_date: "2026-08-01",
          },
        ],
        onSelect: () => {
          window.__adaptSelections += 1;
        },
      }),
      renderProjectTimeline({
        projects: [
          {
            id: "project-1",
            name: longText,
            client_company: "Luenio",
            status: "activo",
            progress_percent: 72,
            budget: 18000,
            owner_name: "Equipo adaptable",
            start_date: "2026-07-01",
            end_date: "2026-09-30",
          },
        ],
        onSelect: () => {
          window.__adaptSelections += 1;
        },
      }),
      renderAgencyCommandCenter({
        mrr: 12000,
        mrrDelta: 4.2,
        openPipeline: 62000,
        openDealsCount: 8,
        openInvoices: 7400,
        openInvoicesCount: 3,
        activeClients: 18,
        activeProjects: 7,
        pipeline: [],
        topDeals: [],
        invoicesAtRisk: [],
        projectsActive: [],
        snapshots: [],
        recentLeads: [],
      }),
    );
  });
  const componentAdaptation = await page.evaluate(() => {
    const kanbanColumn = document.querySelector(".kanban__col");
    const invoiceRow = document.querySelector(".invoice-list tbody tr");
    const metricCard = document.querySelector(".metric-card");
    const commandKpis = document.querySelector(".acc-kpis");
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      widest: [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            target: element.className || element.tagName,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.right > window.innerWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 5),
      kanbanWidth: kanbanColumn?.getBoundingClientRect().width || 0,
      kanbanDraggable: document.querySelector(".kanban-card")?.draggable,
      invoiceDisplay: invoiceRow ? getComputedStyle(invoiceRow).display : "",
      metricWidth: metricCard?.getBoundingClientRect().width || 0,
      commandColumns: commandKpis ? getComputedStyle(commandKpis).gridTemplateColumns : "",
    };
  });
  assert(
    !componentAdaptation.overflow,
    `Shared components must fit the mobile viewport: ${JSON.stringify(componentAdaptation.widest)}`,
  );
  assert(componentAdaptation.kanbanWidth <= 350, "Kanban columns must fit a phone viewport.");
  assert(
    componentAdaptation.kanbanDraggable === false,
    "Touch Kanban must not depend on dragging.",
  );
  assert(
    componentAdaptation.invoiceDisplay === "block",
    "Mobile invoices must adapt into readable records.",
  );
  assert(componentAdaptation.metricWidth <= 366, "Metric cards must reflow to one column.");
  assert(
    componentAdaptation.commandColumns.split(" ").length === 1,
    "Command-center KPIs must become one column on narrow phones.",
  );
  await page.locator(".kanban-card").focus();
  await page.keyboard.press("Enter");
  await page.locator(".invoice-list tbody tr").focus();
  await page.keyboard.press(" ");
  await page.getByRole("button", { name: /Abrir proyecto/ }).focus();
  await page.keyboard.press("Enter");
  assert(
    (await page.evaluate(() => window.__adaptSelections)) === 3,
    "Touch-adapted records must retain keyboard activation.",
  );
  await page.waitForTimeout(50);
  const motionState = await page.evaluate(() => {
    const animations = document.getAnimations();
    return {
      running: animations.filter((animation) => animation.playState === "running").length,
      animationCount: animations.length,
      nonessentialLoops: animations.filter((animation) => {
        const target = animation.effect?.target;
        return (
          animation.effect?.getTiming().iterations === Infinity &&
          !target?.classList?.contains("skeleton")
        );
      }).length,
    };
  });
  assert(
    motionState.animationCount >= 3,
    `Shared components must expose meaningful motion feedback: ${JSON.stringify(motionState)}`,
  );
  assert(motionState.nonessentialLoops === 0, "Operate motion must not add nonessential loops.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionBlocked = await page.evaluate(async () => {
    const { animateLedgerTransition } = await import("/components/index.js");
    const target = document.querySelector(".metrics-grid");
    return animateLedgerTransition(target, 1) === null;
  });
  assert(reducedMotionBlocked, "Reduced motion must block authored component animations.");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.evaluate(async () => {
    const { openModal } = await import("/components/ui/Modal.js");
    document.body.innerHTML = '<button id="origin" type="button">Abrir</button>';
    const origin = document.querySelector("#origin");
    origin.focus();
    const form = document.createElement("form");
    form.innerHTML = '<label>Nombre<input name="name" value="Cliente ✅" /></label>';
    window.__hardeningConfirmCalls = 0;
    openModal({
      title: "Confirmación resistente",
      body: form,
      onConfirm: async () => {
        window.__hardeningConfirmCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return false;
      },
    });
  });
  const dialog = page.getByRole("dialog", { name: "Confirmación resistente" });
  await dialog.waitFor({ state: "visible" });
  await page.waitForTimeout(220);
  const dialogBottomGap = await dialog.evaluate((element) =>
    Math.abs(window.innerHeight - element.getBoundingClientRect().bottom),
  );
  assert(dialogBottomGap <= 1, "Mobile modal must adapt into a bottom sheet.");
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".ui-modal__foot button")];
    buttons.at(-1).click();
    buttons.at(-1).click();
  });
  await page.waitForTimeout(20);
  assert(await dialog.getByRole("button", { name: "Procesando…" }).isDisabled(), "Pending modal.");
  await page.waitForTimeout(130);
  assert(
    (await page.evaluate(() => window.__hardeningConfirmCalls)) === 1,
    "Modal confirmation must be idempotent while pending.",
  );
  const confirm = dialog.getByRole("button", { name: "Confirmar" });
  await confirm.focus();
  await page.keyboard.press("Tab");
  assert(
    await dialog
      .locator('input[name="name"]')
      .evaluate((element) => element === document.activeElement),
    "Modal focus must wrap.",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(220);
  assert(
    await page.locator("#origin").evaluate((element) => element === document.activeElement),
    "Closing a modal must restore focus to its trigger.",
  );

  await page.evaluate(async () => {
    const { openModal } = await import("/components/ui/Modal.js");
    openModal({
      title: "Error recuperable",
      body: "Contenido",
      onConfirm: async () => {
        throw new Error("forced");
      },
    });
  });
  const errorDialog = page.getByRole("dialog", { name: "Error recuperable" });
  await errorDialog.getByRole("button", { name: "Confirmar" }).click();
  await errorDialog.getByRole("alert").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");

  await page.route("**/api/crm/timeout-probe", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const timeoutName = await page.evaluate(async () => {
    const { requestCrmJson } = await import("/apps/admin/crm/app.js");
    try {
      await requestCrmJson("/api/crm/timeout-probe", { timeoutMs: 30 });
      return "none";
    } catch (error) {
      return error.name;
    }
  });
  assert(timeoutName === "TimeoutError", `Expected TimeoutError, received ${timeoutName}.`);

  await context.close();
  console.info("UI hardening checks passed");
} catch (error) {
  error.message = `${error.message}\n\nServer output:\n${serverOutput || "(no output)"}`;
  throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && !server.killed) server.kill();
  await serverClosed;
}
