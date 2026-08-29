/* global document */

import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { stopTestProcess, testProcessOptions } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";
import { SECTORS, demoPath, nichePath } from "../config/sectors.js";

const ROUTES = ["/", "/demos", "/cotizacion", ...SECTORS.map(nichePath), ...SECTORS.map(demoPath)];
const VIEWPORTS = [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-375", width: 375, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-1024", width: 1024, height: 900 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    throw new Error(`No browser available: ${bundledError.message}`);
  }
}

const port = await getFreePort();
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
      PUBLIC_DEMO_MODE: "true",
      ENABLE_AGENCY_CRM: "false",
      ENABLE_PUBLIC_BILLING: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }),
);
let browser;
try {
  await waitForServer(baseUrl);
  browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "es-CO",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ROUTES) {
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.evaluate(() => document.fonts?.ready);
      const result = await page.evaluate(() => {
        const viewportWidth = globalThis.innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const headings = [...document.querySelectorAll("h1")]
          .filter((element) => element.getClientRects().length)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          });
        const activeIndustry = document.querySelector('#industryLinks a[aria-current="page"]');
        const activeRect = activeIndustry?.getBoundingClientRect();
        const overflowingElements = [...document.querySelectorAll("body *")]
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(
            ({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1),
          )
          .slice(0, 8)
          .map(({ element, rect }) => ({
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            id: element.id,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          }));
        const overflowContainers = [
          document.documentElement,
          document.body,
          ...document.querySelectorAll("body *"),
        ]
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .slice(0, 8)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            id: element.id,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
        return {
          documentWidth,
          viewportWidth,
          headings,
          activeIndustry: activeRect ? { left: activeRect.left, right: activeRect.right } : null,
          overflowingElements,
          overflowContainers,
        };
      });

      assert(
        result.documentWidth <= result.viewportWidth + 1,
        `${viewport.name} ${route} has horizontal document overflow: ${JSON.stringify(result)}`,
      );
      assert(
        result.headings.every(
          (heading) => heading.left >= -1 && heading.right <= result.viewportWidth + 1,
        ),
        `${viewport.name} ${route} has a clipped heading: ${JSON.stringify(result.headings)}`,
      );
      if (result.activeIndustry && viewport.width <= 560) {
        assert(
          result.activeIndustry.left >= -1 &&
            result.activeIndustry.right <= result.viewportWidth + 1,
          `${viewport.name} ${route} hides the active industry link: ${JSON.stringify(result)}`,
        );
      }
    }
    console.log(`[responsive-matrix] ${viewport.name} passed ${ROUTES.length} routes`);
  }
  await context.close();
  console.log(
    `[responsive-matrix] ${VIEWPORTS.length * ROUTES.length} route/viewport checks passed`,
  );
} finally {
  await browser?.close();
  await stopTestProcess(server, { label: "responsive matrix server" });
}
