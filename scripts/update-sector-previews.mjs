import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";

const baseUrl = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:4180";
const outputDirectory = path.resolve("public/assets/previews");
const temporaryDirectory = path.resolve("test-results/sector-previews");
const allSectors = [
  ["agency", "/agencias"],
  ["ecommerce", "/tiendas-online"],
  ["gym", "/gimnasios"],
  ["real-estate", "/inmobiliarias"],
  ["restaurants", "/restaurantes"],
  ["veterinary", "/veterinarias"],
  ["aesthetics", "/esteticas"],
];
const requestedSectors = new Set(
  (process.env.PREVIEW_SECTORS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const sectors = requestedSectors.size
  ? allSectors.filter(([name]) => requestedSectors.has(name))
  : allSectors;

// One 1440x1000 capture feeds every variant; the mobile cut is that same frame
// downscaled, not a phone-viewport screenshot, so both show the identical layout.
// Phones only get AVIF: the WebP fallback is for engines without AVIF support,
// and serving those the desktop cut is an acceptable trade for 7 fewer files.
const allVariants = [
  { suffix: "desktop", width: null, formats: ["webp", "avif"] },
  { suffix: "mobile", width: 640, formats: ["avif"] },
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

function encode(pipeline, format) {
  return format === "webp"
    ? pipeline.webp({ quality: 82, effort: 5 })
    : pipeline.avif({ quality: 62, effort: 5 });
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
  deviceScaleFactor: 1,
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
        variant.formats.map((format) => {
          const pipeline = source.clone();
          return encode(
            variant.width ? pipeline.resize({ width: variant.width }) : pipeline,
            format,
          ).toFile(path.join(outputDirectory, `${name}-${variant.suffix}.${format}`));
        }),
      ),
    );
    console.info(`[sector-preview] ${name} -> ${variants.map(({ suffix }) => suffix).join(", ")}`);
  }
} finally {
  await context.close();
  await browser.close();
}
