import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";

export const maxDiffRatio = 0.005;
// Chromium and system Chrome rasterize scaled AVIF text edges slightly differently.
// Keep geometry strict (0.5% of pixels) while ignoring imperceptible edge antialiasing.
export const channelTolerance = 48;

export const defaultContextOptions = {
  locale: "es-CO",
  reducedMotion: "reduce",
  serviceWorkers: "block",
};

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function createLocalRequestFilter(baseUrl) {
  return async (route) => {
    if (route.request().url().startsWith(baseUrl)) {
      await route.continue();
      return;
    }
    await route.abort();
  };
}

export async function launchBrowser() {
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

export async function preparePage(page, scenario, baseUrl) {
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
  });
  // Nested requestAnimationFrame calls are how this used to wait a couple of
  // paint frames for layout/paint to settle after the awaits above, but
  // headless Chromium in CI can throttle rAF to a crawl (seconds per frame,
  // not ~16ms) -- across 44 scenarios that alone was enough to blow the
  // gate's timeout for this step. A fixed short wait is slower than an ideal
  // rAF would be, but nowhere near as slow as a throttled one, and is what
  // actually determines this step's real-world runtime.
  await page.waitForTimeout(50);
}

export async function compareImages(actualPath, baselinePath, diffPath) {
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
