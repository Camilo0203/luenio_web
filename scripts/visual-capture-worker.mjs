import fs from "node:fs";
import {
  defaultContextOptions,
  createLocalRequestFilter,
  launchBrowser,
  preparePage,
} from "./visual-regression-shared.mjs";

// One scenario per process, launched fresh every time. The parent supervises
// this process from outside with its own hard timeout and can SIGKILL the
// whole tree on a stall -- a same-process timeout can't recover from a stall
// that blocks the event loop itself, which is what a wedged Playwright/CDP
// pipe does.
async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Missing capture config path argument.");
  const { scenario, baseUrl, actualPath, storageStatePath } = JSON.parse(
    fs.readFileSync(configPath, "utf8"),
  );

  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      ...defaultContextOptions,
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });
    await context.route("**/*", createLocalRequestFilter(baseUrl));
    const page = await context.newPage();
    await preparePage(page, scenario, baseUrl);
    await page.screenshot({
      path: actualPath,
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      scale: "css",
    });
  } finally {
    await browser?.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
