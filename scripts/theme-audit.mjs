/* global document, getComputedStyle, localStorage, requestAnimationFrame, window */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { stopTestProcess } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";
import { SECTORS, demoPath } from "../config/sectors.js";
import { canonicalPublicPaths } from "../lib/public-routes.js";

let baseUrl = process.env.THEME_AUDIT_BASE_URL || "";
// Every indexable page plus the simulations, derived from the same table the
// sitemap uses. It used to be a hand-written list, so each new section — the
// guides, then the service and city pages — silently escaped the light/dark
// audit until someone remembered to add it here.
const defaultRoutes = [...canonicalPublicPaths(), ...SECTORS.map(demoPath)];
const routes = process.env.THEME_AUDIT_ROUTES
  ? process.env.THEME_AUDIT_ROUTES.split(",").map((route) => route.trim())
  : defaultRoutes;
const themes = process.env.THEME_AUDIT_THEMES
  ? process.env.THEME_AUDIT_THEMES.split(",").map((theme) => theme.trim())
  : ["light", "dark"];

// Excepciones de contraste, aceptadas a mano y con nombre.
//
// El botón de WhatsApp lleva letra blanca sobre el verde de marca por decisión
// expresa de Camilo el 2026-09-11, tomada con la medida delante: 1,98 frente a
// un mínimo de 4,5. Se le ofrecieron las tres combinaciones que sí cumplen con
// letra blanca (#075e54 da 7,67, #0d7a3f da 5,42) y la tinta oscura sobre este
// mismo verde, que da 9,38. Eligió el verde de marca con letra blanca porque es
// como se ve el botón de WhatsApp en todas partes.
//
// La excepción es lo más estrecha que se puede escribir: solo ese control, solo
// contraste. Cualquier otro fallo de contraste en cualquier otro sitio sigue
// parando el gate.
const ACCEPTED_CONTRAST = [
  ".luenio-wa__trigger",
  ".luenio-wa__submit",
  ".wa-widget__trigger",
  ".wa-widget__submit",
  ".gym-whatsapp-cta",
];

function isAcceptedContrast(target) {
  return ACCEPTED_CONTRAST.some((selector) => target.includes(selector));
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
  throw new Error("No se encontró Chromium, Chrome ni Edge para ejecutar la auditoría.");
}

async function startServer() {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
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
      ENABLE_AGENCY_CRM: "false",
      TURNSTILE_REQUIRED: "false",
      ADMIN_MFA_REQUIRED: "false",
      CONTACT_DELIVERY_WORKER_ENABLED: "false",
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
    await waitForServer(url);
  } catch (error) {
    await stopTestProcess(server, { label: "theme audit server" });
    throw new Error(`${error.message}\n\nServer output:\n${output || "(no output)"}`);
  }
  return { server, url };
}

const localServer = baseUrl ? null : await startServer();
if (localServer) baseUrl = localServer.url;
let browser;
const failures = [];

try {
  browser = await launchBrowser();
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
      await page.goto(`${baseUrl}${route}`, { waitUntil: "load", timeout: 60_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const failedStylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
          .filter((link) => !link.sheet)
          .map((link) => link.href);
        if (failedStylesheets.length) {
          throw new Error(`Stylesheets did not load: ${failedStylesheets.join(", ")}`);
        }
      });
      // `link.sheet` can exist before an imported stylesheet has finished applying in
      // system Chrome. Wait for durable home-page colors so Axe never audits the
      // browser's black/blue defaults against already-painted dark sections.
      await page.waitForFunction(
        () => {
          if (!document.body.classList.contains("home-clarity")) return true;
          const processSection = document.querySelector(".hc-process");
          const footerLink = document.querySelector(".site-footer nav a");
          return (
            processSection &&
            footerLink &&
            getComputedStyle(processSection).color !== "rgb(0, 0, 0)" &&
            getComputedStyle(footerLink).color !== "rgb(0, 0, 238)"
          );
        },
        undefined,
        { timeout: 15_000 },
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );

      const layout = await page.evaluate(() => ({
        activeTheme: document.documentElement.dataset.theme || "",
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      }));
      let results;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        if (!results.violations.length || attempt === 3) break;
        await page.waitForTimeout(500);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
      }
      const contrastNodes = results.violations
        .flatMap((violation) =>
          violation.nodes.map((node) => ({
            target: node.target.join(" "),
            summary: node.failureSummary || violation.help,
          })),
        )
        .filter((node) => !isAcceptedContrast(node.target));

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
  await browser?.close();
  if (localServer) {
    await stopTestProcess(localServer.server, { label: "theme audit server" });
  }
}

if (failures.length) {
  console.error("\n[theme-audit] Hallazgos:");
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.info("\n[theme-audit] Todas las páginas pasaron en claro y oscuro.");
}
