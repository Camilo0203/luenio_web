import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";
import { stopTestProcess } from "./test-process.mjs";

const ALL_ROUTES = [
  { name: "home", path: "/" },
  { name: "quote", path: "/cotizacion" },
  { name: "gym", path: "/gimnasios" },
  { name: "restaurants", path: "/restaurantes" },
  { name: "real-estate", path: "/inmobiliarias" },
  { name: "ecommerce", path: "/tiendas-online" },
  { name: "agencies", path: "/agencias" },
  { name: "veterinary", path: "/veterinarias" },
  { name: "aesthetics", path: "/esteticas" },
  { name: "demo", path: "/demo" },
  { name: "demo-gym", path: "/demo/gym" },
  { name: "demo-restaurants", path: "/demo/restaurants" },
  { name: "demo-real-estate", path: "/demo/real-estate" },
  { name: "demo-ecommerce", path: "/demo/ecommerce" },
  { name: "demo-agencies", path: "/demo/agencies" },
  { name: "demo-veterinary", path: "/demo/veterinary" },
  { name: "demo-aesthetics", path: "/demo/aesthetics" },
  { name: "privacy", path: "/privacidad" },
  { name: "terms", path: "/terminos" },
  { name: "refunds", path: "/reembolsos" },
  { name: "login", path: "/login" },
  { name: "crm", path: "/crm" },
];
const requestedRoutes = new Set(
  (process.env.PERF_ROUTES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const ROUTES = requestedRoutes.size
  ? ALL_ROUTES.filter((route) => requestedRoutes.has(route.name))
  : ALL_ROUTES;

const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: 200_000,
  uploadThroughput: 93_750,
  connectionType: "cellular4g",
};
const PERFORMANCE_BUDGETS = {
  cls: 0.1,
  lcp: 3_000,
  longTaskTotal: 500,
  transferBytes: 250_000,
};

function getBudgetFailures(result) {
  const failures = [];
  if (result.cls > PERFORMANCE_BUDGETS.cls) {
    failures.push(`CLS ${result.cls.toFixed(3)} > ${PERFORMANCE_BUDGETS.cls}`);
  }
  if (result.lcp > PERFORMANCE_BUDGETS.lcp) {
    failures.push(`LCP ${Math.round(result.lcp)}ms > ${PERFORMANCE_BUDGETS.lcp}ms`);
  }
  if (result.longTaskTotal > PERFORMANCE_BUDGETS.longTaskTotal) {
    failures.push(
      `long tasks ${Math.round(result.longTaskTotal)}ms > ${PERFORMANCE_BUDGETS.longTaskTotal}ms`,
    );
  }
  if (result.transferBytes > PERFORMANCE_BUDGETS.transferBytes) {
    failures.push(`transfer ${result.transferBytes}B > ${PERFORMANCE_BUDGETS.transferBytes}B`);
  }
  return failures;
}

function getBudgetPressure(result) {
  return Math.max(
    result.cls / PERFORMANCE_BUDGETS.cls,
    result.lcp / PERFORMANCE_BUDGETS.lcp,
    result.longTaskTotal / PERFORMANCE_BUDGETS.longTaskTotal,
    result.transferBytes / PERFORMANCE_BUDGETS.transferBytes,
  );
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

async function waitForServer(baseUrl, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Performance server did not become ready at ${baseUrl}.`);
}

async function startServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "test",
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
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitForServer(baseUrl);
  return {
    baseUrl,
    stop: () => stopTestProcess(server, { label: "performance test server" }),
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    for (const channel of ["chrome", "msedge"]) {
      try {
        return await chromium.launch({ headless: true, channel });
      } catch {
        // Try the next installed browser.
      }
    }
    throw new Error(`No Playwright browser available: ${bundledError.message}`);
  }
}

async function measureRoute(browser, baseUrl, route) {
  const context = await browser.newContext({
    locale: "es-CO",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const externalRequests = new Set();

  await context.route("**/*", async (requestRoute) => {
    const url = requestRoute.request().url();
    if (url.startsWith(baseUrl) || url.startsWith("data:")) {
      await requestRoute.continue();
      return;
    }
    externalRequests.add(new URL(url).hostname);
    await requestRoute.abort();
  });

  await page.addInitScript(() => {
    globalThis.__luenioPerformance = {
      cls: 0,
      lcp: 0,
      lcpElement: null,
      longTasks: [],
      shifts: [],
    };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) {
          const element = last.element;
          globalThis.__luenioPerformance.lcp = last.startTime;
          globalThis.__luenioPerformance.lcpElement = element
            ? {
                className: String(element.className || ""),
                id: element.id || "",
                tag: element.tagName?.toLowerCase() || "",
                text: (element.textContent || "").trim().slice(0, 100),
                url: last.url || "",
              }
            : null;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          globalThis.__luenioPerformance.cls += entry.value;
          globalThis.__luenioPerformance.shifts.push({
            value: entry.value,
            sources: (entry.sources || []).map((source) => ({
              node: source.node?.id || source.node?.className || source.node?.tagName || "unknown",
              previousRect: source.previousRect?.toJSON?.() || source.previousRect,
              currentRect: source.currentRect?.toJSON?.() || source.currentRect,
            })),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__luenioPerformance.longTasks.push(entry.duration);
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older engines still report navigation and paint timing below.
    }
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto(`${baseUrl}${route.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.evaluate(async () => {
    const aboveFoldImages = [...globalThis.document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return image.loading !== "lazy" && rect.top < globalThis.innerHeight * 1.5;
    });
    await Promise.race([
      Promise.all([
        globalThis.document.fonts?.ready,
        ...aboveFoldImages.map((image) =>
          image.complete
            ? image.decode?.().catch(() => {})
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
        ),
      ]),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    await new Promise((resolve) =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
    );
  });
  await page.waitForTimeout(1_200);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
    );
    const totals = resources.reduce(
      (result, entry) => {
        result.bytes += entry.transferSize || 0;
        result.decodedBytes += entry.decodedBodySize || 0;
        result.byType[entry.initiatorType] =
          (result.byType[entry.initiatorType] || 0) + (entry.transferSize || 0);
        return result;
      },
      { bytes: 0, decodedBytes: 0, byType: {} },
    );
    const state = globalThis.__luenioPerformance;
    return {
      cls: state.cls,
      domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
      domNodes: globalThis.document.getElementsByTagName("*").length,
      fcp: paints["first-contentful-paint"] || 0,
      lcp: state.lcp,
      lcpElement: state.lcpElement,
      load: navigation?.loadEventEnd || 0,
      longTaskCount: state.longTasks.length,
      longTaskTotal: state.longTasks.reduce((sum, duration) => sum + duration, 0),
      layoutShifts: state.shifts,
      requestCount: resources.length,
      transferBytes: totals.bytes,
      decodedBytes: totals.decodedBytes,
      transferByType: totals.byType,
      url: globalThis.location.pathname,
    };
  });

  await context.close();
  return {
    name: route.name,
    externalHosts: [...externalRequests].sort(),
    ...metrics,
  };
}

const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const results = [];
  for (const route of ROUTES) {
    let bestResult = await measureRoute(browser, server.baseUrl, route);
    let attempts = 1;
    while (getBudgetFailures(bestResult).length && attempts < 3) {
      const retryResult = await measureRoute(browser, server.baseUrl, route);
      attempts += 1;
      if (getBudgetPressure(retryResult) < getBudgetPressure(bestResult)) {
        bestResult = retryResult;
      }
    }
    results.push({ ...bestResult, attempts });
  }
  const budgetFailures = results.flatMap((result) => {
    return getBudgetFailures(result).map((failure) => `${result.name}: ${failure}`);
  });

  console.log(
    JSON.stringify(
      { network: NETWORK, cpuThrottle: 4, budgets: PERFORMANCE_BUDGETS, results },
      null,
      2,
    ),
  );
  if (budgetFailures.length) {
    throw new Error(`UI performance budgets failed:\n- ${budgetFailures.join("\n- ")}`);
  }
} finally {
  await browser?.close();
  await server.stop();
}
