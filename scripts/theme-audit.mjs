/* global document, localStorage, window */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const baseUrl = process.env.THEME_AUDIT_BASE_URL || "http://127.0.0.1:4180";
const defaultRoutes = [
  "/",
  "/cotizacion",
  "/gimnasios",
  "/restaurantes",
  "/inmobiliarias",
  "/tiendas-online",
  "/agencias",
  "/veterinarias",
  "/esteticas",
  "/demo",
  "/demo/gym",
  "/demo/restaurants",
  "/demo/real-estate",
  "/demo/ecommerce",
  "/demo/agencies",
  "/demo/veterinary",
  "/demo/aesthetics",
  "/privacidad",
  "/terminos",
  "/reembolsos",
];
const routes = process.env.THEME_AUDIT_ROUTES
  ? process.env.THEME_AUDIT_ROUTES.split(",").map((route) => route.trim())
  : defaultRoutes;
const themes = process.env.THEME_AUDIT_THEMES
  ? process.env.THEME_AUDIT_THEMES.split(",").map((theme) => theme.trim())
  : ["light", "dark"];

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
  throw new Error("No se encontró Chromium, Chrome ni Edge para ejecutar la auditoría.");
}

const browser = await launchBrowser();
const failures = [];

try {
  for (const theme of themes) {
    const context = await browser.newContext({
      locale: "es-CO",
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript((activeTheme) => {
      localStorage.setItem("luenio-theme", activeTheme);
    }, theme);

    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);

      const layout = await page.evaluate(() => ({
        activeTheme: document.documentElement.dataset.theme || "",
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      }));
      const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      const contrastNodes = results.violations.flatMap((violation) =>
        violation.nodes.map((node) => ({
          target: node.target.join(" "),
          summary: node.failureSummary || violation.help,
        })),
      );

      if (layout.activeTheme !== theme || layout.overflow > 1 || contrastNodes.length) {
        failures.push({ theme, route, ...layout, contrastNodes });
      }

      console.info(
        `[theme-audit] ${theme.padEnd(5)} ${route.padEnd(20)} ` +
          `theme=${layout.activeTheme || "missing"} overflow=${layout.overflow} ` +
          `contrast=${contrastNodes.length}`,
      );
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("\n[theme-audit] Hallazgos:");
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.info("\n[theme-audit] Todas las páginas pasaron en claro y oscuro.");
}
