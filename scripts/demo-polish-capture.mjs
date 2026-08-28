import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { getFreePort, waitForServer } from "./test-server.mjs";

const outputDir = path.join(process.cwd(), "test-results", "demo-polish");
const routes = [
  { slug: "agencias", landing: "/agencias", simulation: "/demo/agencies" },
  { slug: "ecommerce", landing: "/tiendas-online", simulation: "/demo/ecommerce" },
  { slug: "gimnasio", landing: "/gimnasios", simulation: "/demo/gym" },
  { slug: "inmobiliaria", landing: "/inmobiliarias", simulation: "/demo/real-estate" },
  { slug: "restaurante", landing: "/restaurantes", simulation: "/demo/restaurants" },
];

async function startServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "test",
      LUENIO_SKIP_ENV_FILE: "true",
      REQUIRE_SUPABASE: "false",
      CONTACT_DELIVERY_WORKER_ENABLED: "false",
      TURNSTILE_REQUIRED: "false",
      ADMIN_MFA_REQUIRED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitForServer(baseUrl);
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}\n${output}`);
  }
  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("close", resolve));
    },
  };
}

function labelSvg(label, width, height) {
  const safeLabel = label.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="34" fill="#08162b" fill-opacity=".9"/>
      <text x="14" y="23" fill="#fff" font-family="Arial, sans-serif"
        font-size="15" font-weight="700">${safeLabel}</text>
    </svg>
  `);
}

async function createSheet(items, outputPath, columns, cellWidth, cellHeight) {
  const rows = Math.ceil(items.length / columns);
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const left = (index % columns) * cellWidth;
    const top = Math.floor(index / columns) * cellHeight;
    const image = await sharp(item.path)
      .resize(cellWidth, cellHeight, { fit: "cover", position: "top" })
      .png()
      .toBuffer();
    composites.push({ input: image, left, top });
    composites.push({
      input: labelSvg(item.label, cellWidth, cellHeight),
      left,
      top,
    });
  }
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: "#08162b",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function settlePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await Promise.race([
      globalThis.document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => globalThis.setTimeout(resolve, 4_000)),
    ]);
    await Promise.race([
      Promise.all(
        [...globalThis.document.images].map((image) =>
          image.complete ? Promise.resolve() : image.decode?.().catch(() => {}),
        ),
      ),
      new Promise((resolve) => globalThis.setTimeout(resolve, 4_000)),
    ]);
  });
}

fs.mkdirSync(outputDir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const captures = {
  landingDesktop: [],
  landingDarkDesktop: [],
  simulationDesktop: [],
  landingMobile: [],
  simulationMobile: [],
};
const layoutDiagnostics = [];

try {
  for (const viewport of [
    { key: "Desktop", width: 1280, height: 800 },
    { key: "Mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await context.route("**/*", async (route) => {
      if (route.request().url().startsWith(server.baseUrl)) await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();

    for (const route of routes) {
      for (const surface of ["landing", "simulation"]) {
        const pathname = route[surface];
        await page.goto(`${server.baseUrl}${pathname}`, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        await page.locator("main h1").waitFor({ state: "visible", timeout: 10_000 });
        await settlePage(page);
        layoutDiagnostics.push(
          await page.evaluate(
            ({ slug, surface, viewport }) => {
              const rect = (selector) => {
                const element = globalThis.document.querySelector(selector);
                if (!element) return null;
                const box = element.getBoundingClientRect();
                return {
                  bottom: Math.round(box.bottom),
                  height: Math.round(box.height),
                  left: Math.round(box.left),
                  right: Math.round(box.right),
                  top: Math.round(box.top),
                  width: Math.round(box.width),
                };
              };
              return {
                slug,
                surface,
                viewport,
                heading: rect("main h1"),
                actions: rect(
                  surface === "landing"
                    ? ".demo-hero .demo-actions, .builder-heading + .route-builder"
                    : 'button[id^="run"]',
                ),
                instrument: rect(
                  surface === "landing"
                    ? ".agency-brief-wall, .commerce-lab, .route-builder, .property-concierge, .restaurant-pass"
                    : ".agency-live-card, .ecommerce-conversion-card, .gym-live-card, .real-estate-live-card, .restaurant-live-indicator",
                ),
              };
            },
            { slug: route.slug, surface, viewport: viewport.key.toLowerCase() },
          ),
        );
        const filename = `${surface}-${route.slug}-${viewport.key.toLowerCase()}.png`;
        const filePath = path.join(outputDir, filename);
        await page.screenshot({
          path: filePath,
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          scale: "css",
        });
        captures[`${surface}${viewport.key}`].push({
          label: `${route.slug} · ${surface}`,
          path: filePath,
        });
      }
    }
    await context.close();
  }

  const darkContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  await darkContext.addInitScript(() => {
    globalThis.localStorage.setItem("luenio-theme", "dark");
  });
  await darkContext.route("**/*", async (route) => {
    if (route.request().url().startsWith(server.baseUrl)) await route.continue();
    else await route.abort();
  });
  const darkPage = await darkContext.newPage();
  for (const route of routes) {
    await darkPage.goto(`${server.baseUrl}${route.landing}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await darkPage.locator("main h1").waitFor({ state: "visible", timeout: 10_000 });
    await settlePage(darkPage);
    const filename = `landing-${route.slug}-dark-desktop.png`;
    const filePath = path.join(outputDir, filename);
    await darkPage.screenshot({
      path: filePath,
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      scale: "css",
    });
    captures.landingDarkDesktop.push({
      label: `${route.slug} · landing dark`,
      path: filePath,
    });
  }
  await darkContext.close();

  const desktopActionFailures = layoutDiagnostics.filter(
    ({ actions, slug, surface, viewport }) =>
      viewport === "desktop" &&
      !(surface === "landing" && slug === "gimnasio") &&
      (!actions || actions.top < 0 || actions.bottom > 801),
  );
  if (desktopActionFailures.length > 0) {
    throw new Error(
      `Primary demo actions must remain visible in the desktop hero viewport:\n${JSON.stringify(
        desktopActionFailures,
        null,
        2,
      )}`,
    );
  }

  await createSheet(
    captures.landingDesktop,
    path.join(outputDir, "landings-desktop.png"),
    2,
    640,
    400,
  );
  await createSheet(
    captures.landingDarkDesktop,
    path.join(outputDir, "landings-dark-desktop.png"),
    2,
    640,
    400,
  );
  await createSheet(
    captures.simulationDesktop,
    path.join(outputDir, "simulations-desktop.png"),
    2,
    640,
    400,
  );
  await createSheet(
    captures.landingMobile,
    path.join(outputDir, "landings-mobile.png"),
    5,
    312,
    675,
  );
  fs.writeFileSync(
    path.join(outputDir, "layout.json"),
    `${JSON.stringify(layoutDiagnostics, null, 2)}\n`,
    "utf8",
  );
  await createSheet(
    captures.simulationMobile,
    path.join(outputDir, "simulations-mobile.png"),
    5,
    312,
    675,
  );
  console.info(`Demo polish captures written to ${outputDir}`);
} finally {
  await browser.close();
  await server.stop();
}
