import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { SECTORS, nichePath } from "../config/sectors.js";

const baseUrl = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:4180";
const outputDirectory = path.resolve("public/assets/previews");
const temporaryDirectory = path.resolve("test-results/sector-previews");
// previewSlug names the files under public/assets/previews.
const allSectors = SECTORS.map((sector) => [sector.previewSlug, nichePath(sector)]);
const requestedSectors = new Set(
  (process.env.PREVIEW_SECTORS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const sectors = requestedSectors.size
  ? allSectors.filter(([name]) => requestedSectors.has(name))
  : allSectors;

// One 2880x2000 capture feeds every variant; the mobile cut is that same frame
// downscaled, not a phone-viewport screenshot, so both show the identical layout.
// Phones only get AVIF: the WebP fallback is for engines without AVIF support,
// and serving those the desktop cut is an acceptable trade for 7 fewer files.
// The og cut is 1200x630 JPEG: that is the ratio social platforms crop to, and
// JPEG is the only format every scraper reads reliably.
//
// The capture is taken at twice the delivered size and reduced. Shooting 1440
// native left the interface text aliased, and the home puts one of these inside
// a browser frame where that is the first thing anyone looks at. Supersampling
// buys the detail in the downscale instead of in the file: the delivered cut
// stays 1440x1000, so neither the transfer budget nor the LCP measurement move
// much, and the home prefetches all three shots on idle, which is why a 2x
// delivered variant was rejected — it would triple what every visitor pays.
const allVariants = [
  { suffix: "desktop", width: 1440, formats: ["webp", "avif"] },
  { suffix: "mobile", width: 640, formats: ["avif"] },
  { suffix: "og", width: 1200, height: 630, fit: "cover", position: "top", formats: ["jpg"] },
];
const requestedVariants = new Set(
  (process.env.PREVIEW_VARIANTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const variants = requestedVariants.size
  ? allVariants.filter(({ suffix }) => requestedVariants.has(suffix))
  : allVariants;

// Quality sits a notch above the old numbers because the source now carries
// detail worth keeping; at the previous 62 the downscale was thrown away again
// in the encode.
function encode(pipeline, format) {
  if (format === "webp") return pipeline.webp({ quality: 86, effort: 6 });
  if (format === "jpg") return pipeline.jpeg({ quality: 84, mozjpeg: true });
  return pipeline.avif({ quality: 70, effort: 6 });
}

function resizeFor(pipeline, variant) {
  if (!variant.width) return pipeline;
  return pipeline.resize({
    width: variant.width,
    ...(variant.height ? { height: variant.height } : {}),
    ...(variant.fit ? { fit: variant.fit, position: variant.position || "centre" } : {}),
  });
}

await fs.mkdir(outputDirectory, { recursive: true });
await fs.mkdir(temporaryDirectory, { recursive: true });

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
  throw new Error("No se encontró Chromium, Chrome ni Edge para generar los previews.");
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  locale: "es-CO",
  reducedMotion: "reduce",
});

await context.addInitScript(() => {
  localStorage.setItem("luenio-theme", "light");
});

try {
  const page = await context.newPage();
  for (const [name, route] of sectors) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(temporaryDirectory, `${name}.png`),
      animations: "disabled",
    });

    const source = sharp(path.join(temporaryDirectory, `${name}.png`));
    await Promise.all(
      variants.flatMap((variant) =>
        variant.formats.map((format) =>
          encode(resizeFor(source.clone(), variant), format).toFile(
            path.join(outputDirectory, `${name}-${variant.suffix}.${format}`),
          ),
        ),
      ),
    );
    console.info(`[sector-preview] ${name} -> ${variants.map(({ suffix }) => suffix).join(", ")}`);
  }
} finally {
  await context.close();
  await browser.close();
}
