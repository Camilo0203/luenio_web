/* global document */
/**
 * Browser E2E + a11y (Playwright + axe-core).
 * Starts a local server unless BROWSER_E2E_BASE_URL is set.
 * Fails on axe critical/serious violations.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { stopTestProcess, testProcessOptions } from "./test-process.mjs";
import { getFreePort, waitForServer } from "./test-server.mjs";
import { SECTORS, getSector, nichePath } from "../config/sectors.js";

const fixtureDir = path.join(process.cwd(), "test-results", `.browser-fixture-${process.pid}`);
const localDbPath = path.join(fixtureDir, "leads-db.json");
const externalBaseUrl = process.env.BROWSER_E2E_BASE_URL || process.env.E2E_BASE_URL || "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertThemeSwitch(page, label) {
  const control = page.locator("[data-theme-toggle]").first();
  await control.waitFor({ state: "visible", timeout: 10_000 });
  const before = await page.evaluate(() => {
    const header = globalThis.document.querySelector("header");
    const firstSection = globalThis.document.querySelector("main > section");
    const signature = (element) => {
      if (!element) return "";
      const styles = globalThis.getComputedStyle(element);
      return [styles.color, styles.backgroundColor, styles.backgroundImage].join("|");
    };
    return {
      theme: globalThis.document.documentElement.dataset.theme,
      signature: [signature(globalThis.document.body), signature(header), signature(firstSection)],
    };
  });
  await control.click();
  await page.waitForFunction(
    (previousTheme) => globalThis.document.documentElement.dataset.theme !== previousTheme,
    before.theme,
  );
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => {
    const header = globalThis.document.querySelector("header");
    const firstSection = globalThis.document.querySelector("main > section");
    const signature = (element) => {
      if (!element) return "";
      const styles = globalThis.getComputedStyle(element);
      return [styles.color, styles.backgroundColor, styles.backgroundImage].join("|");
    };
    return {
      pressed: globalThis.document
        .querySelector("[data-theme-toggle]")
        ?.getAttribute("aria-pressed"),
      signature: [signature(globalThis.document.body), signature(header), signature(firstSection)],
      theme: globalThis.document.documentElement.dataset.theme,
    };
  });
  assert(after.theme !== before.theme, `${label} theme control must switch the active theme.`);
  assert(
    after.signature.some((value, index) => value !== before.signature[index]),
    `${label} theme control must produce a visible palette change.`,
  );
  assert(
    after.pressed === String(after.theme === "dark"),
    `${label} theme control must expose its current state.`,
  );
}

async function assertWhatsappStableWhileScrolling(page, label) {
  const maxScroll = await page.evaluate(
    () => globalThis.document.documentElement.scrollHeight - globalThis.innerHeight,
  );
  const samples = [];
  for (const progress of [0, 0.25, 0.5, 0.75, 1, 0.5, 0, 1]) {
    await page.evaluate((top) => globalThis.scrollTo(0, top), maxScroll * progress);
    await page.waitForTimeout(80);
    samples.push(
      await page.locator(".luenio-wa__trigger").evaluate((trigger) => {
        const styles = globalThis.getComputedStyle(trigger);
        const bounds = trigger.getBoundingClientRect();
        return {
          ariaHidden: trigger.getAttribute("aria-hidden"),
          bottom: Math.round(bounds.bottom * 10) / 10,
          lift: styles.getPropertyValue("--luenio-trigger-lift").trim(),
          opacity: Number(styles.opacity),
          right: Math.round(bounds.right * 10) / 10,
          visible: styles.visibility !== "hidden" && styles.display !== "none",
        };
      }),
    );
  }
  const reference = samples[0];
  assert(
    samples.every(
      (sample) =>
        sample.ariaHidden !== "true" &&
        sample.visible &&
        sample.opacity > 0.9 &&
        sample.lift === "0px" &&
        Math.abs(sample.bottom - reference.bottom) <= 1 &&
        Math.abs(sample.right - reference.right) <= 1,
    ),
    `${label} WhatsApp trigger must remain fixed and visible while scrolling: ${JSON.stringify(
      samples,
    )}`,
  );
}

async function getWhatsappPresentation(page) {
  return page.locator(".luenio-wa__trigger").evaluate((trigger) => {
    const styles = globalThis.getComputedStyle(trigger);
    const label = trigger.querySelector("span");
    return {
      background: styles.backgroundColor,
      borderRadius: styles.borderRadius,
      font: styles.font,
      height: Number.parseFloat(styles.height),
      labelDisplay: label ? globalThis.getComputedStyle(label).display : "missing",
      paddingInline: `${styles.paddingInlineStart}|${styles.paddingInlineEnd}`,
      width: Number.parseFloat(styles.width),
    };
  });
}

async function startServer() {
  if (externalBaseUrl) {
    await waitForServer(externalBaseUrl);
    return { baseUrl: externalBaseUrl, stop: async () => {} };
  }

  const port = await getFreePort();
  fs.mkdirSync(fixtureDir, { recursive: true });
  const baseUrl = `http://127.0.0.1:${port}`;
  const healthToken = "luenio-browser-e2e-healthcheck-token-32chars";
  const server = spawn(
    process.execPath,
    ["server.js"],
    testProcessOptions({
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(port),
        HEALTHCHECK_TOKEN: healthToken,
        LUENIO_SKIP_ENV_FILE: "true",
        ENABLE_PUBLIC_BILLING: "true",
        REQUIRE_SUPABASE: "false",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        CONTACT_WEBHOOK_URL: "",
        CONTACT_WEBHOOK_TOKEN: "",
        TURNSTILE_REQUIRED: "false",
        TURNSTILE_SITE_KEY: "",
        TURNSTILE_SECRET_KEY: "",
        LUENIO_LOCAL_DB_PATH: localDbPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitForServer(baseUrl, { child: server });
  } catch (error) {
    await stopTestProcess(server, { label: "browser E2E server" });
    throw new Error(`${error.message}\n\nServer output:\n${output || "(no output)"}`);
  }

  return {
    baseUrl,
    stop: () => stopTestProcess(server, { label: "browser E2E server" }),
  };
}

function formatAxeViolations(violations) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(" ")}: ${node.failureSummary || node.html}`)
        .join("\n");
      return `[${violation.impact}] ${violation.id}: ${violation.help}\n${nodes}`;
    })
    .join("\n\n");
}

async function runAxe(page, label) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    const settleWithin = (promise, timeoutMs) =>
      Promise.race([
        Promise.resolve(promise).catch(() => {}),
        new Promise((resolve) => globalThis.setTimeout(resolve, timeoutMs)),
      ]);
    await settleWithin(globalThis.document.fonts?.ready, 1_000);
    await settleWithin(
      Promise.all(
        [...globalThis.document.images].map((image) =>
          image.complete
            ? image.decode?.().catch(() => {})
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
        ),
      ),
      1_000,
    );
    await new Promise((resolve) =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
    );
    const animations = globalThis.document
      .getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations));
    await settleWithin(
      Promise.all(animations.map((animation) => animation.finished.catch(() => {}))),
      500,
    );
  });

  const invalidPatterns = await page.locator("[pattern]").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const pattern = element.getAttribute("pattern");
      if (!pattern) return [];
      try {
        new RegExp(pattern, "v");
        return [];
      } catch (error) {
        return [
          `${element.tagName.toLowerCase()}[name="${element.getAttribute("name") || ""}"]: ${error.message}`,
        ];
      }
    }),
  );
  assert(
    invalidPatterns.length === 0,
    `${label} contains invalid HTML patterns:\n${invalidPatterns.join("\n")}`,
  );

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  const mild = results.violations.filter(
    (violation) => violation.impact === "moderate" || violation.impact === "minor",
  );

  if (mild.length) {
    console.info(
      `[browser-e2e] a11y advisory (${label}): ${mild.length} moderate/minor — not failing gate`,
    );
  }

  assert(
    blocking.length === 0,
    `a11y ${label} has ${blocking.length} critical/serious violation(s):\n${formatAxeViolations(blocking)}`,
  );
  console.info(`[browser-e2e] a11y ok: ${label}`);
}

async function expectVisibleText(page, text, label) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  assert(await locator.isVisible(), `${label} must show "${text}"`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    for (const channel of ["chrome", "msedge"]) {
      try {
        const browser = await chromium.launch({ headless: true, channel });
        console.info(`[browser-e2e] Using system browser channel: ${channel}`);
        return browser;
      } catch {
        // try next channel
      }
    }
    throw new Error(
      `Playwright Chromium is not installed and no Chrome/Edge channel worked.\n` +
        `Run: npm run playwright:install\n` +
        `Original error: ${bundledError.message}`,
    );
  }
}

async function runBrowserChecks(baseUrl) {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "es-CO",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(30_000);
  const browserErrors = [];

  page.on("pageerror", (error) => {
    browserErrors.push(`pageerror: ${String(error?.message || error)}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  try {
    // --- Public landing ---
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "Luenio", "home brand");
    await page.locator('[data-quote-cta="hero"]').waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.getByRole("link", { name: "Explorar demos", exact: true }).waitFor({
      state: "visible",
      timeout: 10_000,
    });
    assert(
      (await page.locator('a.skip-link[href="#contenido"]').count()) >= 1,
      "Home must expose a skip link to main content.",
    );
    assert(
      (await page.locator("html").getAttribute("lang"))?.toLowerCase().startsWith("es"),
      "Home document language must be Spanish.",
    );
    await expectVisibleText(
      page,
      "Tu próxima solución digital, lista para vender y dar seguimiento.",
      "home value proposition",
    );
    await runAxe(page, "home");
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.waitForFunction(
      () => globalThis.document.querySelector(".hc-hero")?.classList.contains("is-motion-active"),
      null,
      { timeout: 5_000 },
    );

    const motionContract = await page.evaluate(() => ({
      motionReady: document.querySelector(".home-clarity")?.classList.contains("motion-ready"),
      heroActive: document.querySelector(".hc-hero")?.classList.contains("is-motion-active"),
      heroStageAnimation: globalThis.getComputedStyle(document.querySelector(".hc-browser"))
        .animationName,
      signalAnimation: globalThis.getComputedStyle(document.querySelector(".hc-hero__signal-node"))
        .animationName,
      previewSweep: globalThis.getComputedStyle(
        document.querySelector(".hc-browser__viewport"),
        "::after",
      ).animationName,
      typingDots: document.querySelectorAll(".hc-chat-typing span").length,
    }));
    assert(motionContract.motionReady, "Home motion must initialize without hiding content.");
    assert(motionContract.heroActive, "Hero motion must activate while the hero is visible.");
    assert(
      motionContract.heroStageAnimation === "hc-stage-in" &&
        motionContract.signalAnimation === "hc-signal-node-in" &&
        motionContract.previewSweep === "hc-preview-scan",
      `Home must expose the authored motion sequence: ${JSON.stringify(motionContract)}`,
    );
    assert(
      motionContract.typingDots === 9,
      "Chatbot preview must expose one typing indicator per channel.",
    );

    const conversationTabs = page.getByRole("tab");
    assert(
      (await conversationTabs.count()) === 3,
      "Home chatbot preview must expose WhatsApp, Instagram and Facebook tabs.",
    );
    const instagramTab = page.getByRole("tab", { name: "Instagram", exact: true });
    await instagramTab.click();
    await page.locator("#chat-panel-instagram").waitFor({ state: "visible" });
    assert(
      (await instagramTab.getAttribute("aria-selected")) === "true" &&
        (await page.locator("#chat-panel-whatsapp").isVisible()) === false,
      "Chatbot preview must switch the visible panel and selected tab.",
    );
    await instagramTab.press("ArrowRight");
    assert(
      (await page
        .getByRole("tab", { name: "Facebook", exact: true })
        .getAttribute("aria-selected")) === "true",
      "Chatbot tabs must support arrow-key navigation.",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(180);
    const reducedMotionContract = await page.evaluate(() => ({
      revealOpacity: globalThis.getComputedStyle(document.querySelector("[data-reveal]")).opacity,
      heroStageAnimation: globalThis.getComputedStyle(document.querySelector(".hc-browser"))
        .animationName,
      signalAnimation: globalThis.getComputedStyle(document.querySelector(".hc-hero__signal-node"))
        .animationName,
      previewSweep: globalThis.getComputedStyle(
        document.querySelector(".hc-browser__viewport"),
        "::after",
      ).animationName,
      typingAnimation: globalThis.getComputedStyle(document.querySelector(".hc-chat-typing span"))
        .animationName,
    }));
    assert(
      reducedMotionContract.revealOpacity === "1" &&
        reducedMotionContract.heroStageAnimation === "none" &&
        reducedMotionContract.signalAnimation === "none" &&
        reducedMotionContract.previewSweep === "none" &&
        reducedMotionContract.typingAnimation === "none",
      `Reduced motion must disable authored home motion: ${JSON.stringify(reducedMotionContract)}`,
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload({ waitUntil: "domcontentloaded" });

    await assertThemeSwitch(page, "Home");

    // Mobile nav toggle
    await page.setViewportSize({ width: 390, height: 844 });
    const menuToggle = page.locator("[data-menu-toggle]");
    if ((await menuToggle.count()) > 0) {
      const navigation = page.locator("[data-navigation]").first();
      const controlledNavigation = await menuToggle.first().getAttribute("aria-controls");
      assert(
        controlledNavigation && controlledNavigation === (await navigation.getAttribute("id")),
        "Mobile menu toggle must identify the navigation it controls.",
      );
      await navigation.waitFor({ state: "attached" });
      await page.waitForFunction(() => {
        const mobileNavigation = document.querySelector("[data-navigation]");
        return (
          mobileNavigation?.hasAttribute("inert") &&
          mobileNavigation.getAttribute("aria-hidden") === "true"
        );
      });
      assert(
        (await navigation.getAttribute("inert")) !== null &&
          (await navigation.getAttribute("aria-hidden")) === "true",
        "Closed mobile navigation must leave the keyboard and accessibility trees.",
      );
      await menuToggle.first().click();
      assert(
        (await menuToggle.first().getAttribute("aria-expanded")) === "true",
        "Mobile menu toggle must set aria-expanded=true when open.",
      );
      assert(
        (await navigation.getAttribute("inert")) === null &&
          (await navigation.getAttribute("aria-hidden")) === "false",
        "Open mobile navigation must restore its links to keyboard and assistive technology.",
      );
      assert(
        (await page.locator("main").getAttribute("inert")) !== null &&
          (await page.locator("footer").getAttribute("inert")) !== null,
        "Open mobile navigation must isolate background content.",
      );
      await page.keyboard.press("Escape");
      assert(
        (await menuToggle.first().getAttribute("aria-expanded")) === "false" &&
          (await navigation.getAttribute("inert")) !== null,
        "Escape must close mobile navigation.",
      );
      assert(
        await menuToggle
          .first()
          .evaluate((element) => element === element.ownerDocument.activeElement),
        "Escape must return focus to the mobile menu toggle.",
      );
      assert(
        (await page.locator("main").getAttribute("inert")) === null &&
          (await page.locator("footer").getAttribute("inert")) === null,
        "Closing mobile navigation must restore background content.",
      );
    }

    const ecommerceDemoButton = page.getByRole("button", { name: "Ecommerce", exact: true });
    await ecommerceDemoButton.evaluate((button) => button.click());
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('[data-demo-target="ecommerce"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    await page.getByText("Mostrando demo ficticia de Ecommerce", { exact: true }).waitFor({
      state: "visible",
    });
    assert(
      (await page
        .getByRole("link", { name: "Abrir demo de Ecommerce, demostración ficticia" })
        .getAttribute("href")) === "/tiendas-online",
      "Mobile demo selection must expose the selected demo destination.",
    );
    const agencyDemoButton = page.getByRole("button", { name: "Agencias", exact: true });
    await agencyDemoButton.evaluate((button) => button.click());
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('[data-demo-target="agencias"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    const homeDemoQuote = page.locator("[data-demo-quote-link]");
    const homeDemoQuoteHref = await homeDemoQuote.getAttribute("href");
    assert(
      homeDemoQuoteHref?.includes("sector=agencia") &&
        homeDemoQuoteHref.includes("demo=Impulso+Digital") &&
        homeDemoQuoteHref.includes("source=home_demo"),
      `Home demo CTA must preserve the active journey: ${homeDemoQuoteHref}`,
    );
    await page.evaluate(() => {
      const link = document.querySelector("[data-demo-quote-link]");
      link?.addEventListener("click", (event) => event.preventDefault(), { once: true });
      link?.click();
    });
    const homeQuoteEvents = await page.evaluate(() =>
      JSON.parse(globalThis.localStorage.getItem("luenio.analytics.events") || "[]").filter(
        (event) => event.name === "quote_cta_click" || event.name === "demo_context_preserved",
      ),
    );
    assert(
      homeQuoteEvents.some(
        (event) =>
          event.properties.sector === "agencia" &&
          event.properties.demo === "Impulso Digital" &&
          event.properties.service === "Landing + automatización completa" &&
          event.properties.source === "home_demo",
      ),
      `Home demo CTA analytics must preserve the active journey: ${JSON.stringify(homeQuoteEvents)}`,
    );
    await page.setViewportSize({ width: 1280, height: 800 });

    // --- Public funnel continuity: home -> demo -> contextual quote -> confirmation ---
    const agencyDemoCard = page.locator(
      '.hc-browser__open[data-demo-case="impulso-digital"][href="/agencias"]',
    );
    assert((await agencyDemoCard.count()) === 1, "Home must expose the featured agency demo.");
    await Promise.all([
      page.waitForURL(`${baseUrl}/agencias`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      }),
      agencyDemoCard.evaluate((link) => link.click()),
    ]);

    const demoQuoteTrigger = page.locator("[data-luenio-open]").first();
    await demoQuoteTrigger.waitFor({ state: "visible" });
    await demoQuoteTrigger.evaluate((trigger) => trigger.click());
    const contextualQuoteLink = page.locator("[data-quote-link]");
    await contextualQuoteLink.waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Enviar a WhatsApp" }).click();
    await expectVisibleText(
      page,
      "Completa tu nombre, negocio y un número de WhatsApp válido",
      "demo widget validation",
    );
    assert(
      (await page
        .locator("#luenio-contact-form input[name='name']")
        .getAttribute("aria-invalid")) === "true",
      "Demo widget validation must expose the first invalid field.",
    );
    const contextualQuoteHref = await contextualQuoteLink.getAttribute("href");
    assert(
      contextualQuoteHref?.startsWith("/cotizacion?") &&
        contextualQuoteHref.includes("sector=agencia") &&
        contextualQuoteHref.includes("demo=Impulso+Digital") &&
        contextualQuoteHref.includes("service=Landing+%2B+automatizaci%C3%B3n+completa"),
      `Demo quote link must preserve its context: ${contextualQuoteHref}`,
    );

    await page.goto(`${baseUrl}${contextualQuoteHref}`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "Continuamos desde la demo Impulso Digital", "quote context");
    const quoteForm = page.locator(".quote-form");
    const quoteService = quoteForm.locator('select[name="service"]');
    const quoteObjective = quoteForm.locator('textarea[name="message"]');
    assert(
      (await quoteService.inputValue()) === "Landing + automatización completa",
      "Contextual quote must preselect the demo service.",
    );
    assert(
      (await quoteObjective.inputValue()).includes("agencia"),
      "Contextual quote must preserve the demo goal.",
    );
    assert(
      (await quoteForm.getAttribute("data-source")) === "cotizacion_landing_agencies",
      "Contextual quote must preserve an analytics source.",
    );

    assert(
      (await page.locator("[data-wa-form]").count()) <= 1,
      "Quote page must render at most one shared WhatsApp form.",
    );

    await quoteForm.locator('input[name="name"]').fill("Persona Demo");
    await quoteForm.locator('input[name="business"]').fill("Negocio Demo");
    await quoteForm.locator('input[name="phone"]').fill("3001234567");
    // The public anti-bot contract intentionally rejects submissions completed in under 1.5 s.
    await page.waitForTimeout(1_600);
    await quoteForm.getByRole("button", { name: "Solicitar cotización gratis" }).click();
    const quoteStatus = quoteForm.locator("[data-form-status]");
    await page.waitForFunction(
      () => {
        const status = globalThis.document.querySelector(".quote-form [data-form-status]");
        return status && !status.hidden && !String(status.textContent || "").includes("Enviando");
      },
      undefined,
      { timeout: 15_000 },
    );
    const quoteStatusText = await quoteStatus.innerText();
    assert(
      quoteStatusText.includes("Solicitud recibida"),
      `Contextual quote must reach confirmation, received: ${quoteStatusText}`,
    );
    const funnelEventNames = await page.evaluate(() =>
      JSON.parse(globalThis.localStorage.getItem("luenio.analytics.events") || "[]").map(
        (event) => event.name,
      ),
    );
    assert(
      funnelEventNames.includes("demo_case_click") &&
        funnelEventNames.includes("quote_context_applied") &&
        funnelEventNames.includes("generate_lead"),
      `Public funnel analytics must cover demo, context and confirmation: ${funnelEventNames.join(", ")}`,
    );
    await runAxe(page, "cotizacion-contextual");

    // --- Niche landing ---
    await page.goto(`${baseUrl}/gimnasios`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "Titan Fitness", "niche gym page");
    const gymHeaderQuote = await page
      .locator("header [data-quote-cta]")
      .first()
      .getAttribute("href");
    assert(
      gymHeaderQuote?.startsWith("/cotizacion?") &&
        gymHeaderQuote.includes("sector=") &&
        gymHeaderQuote.includes("demo=") &&
        gymHeaderQuote.includes("service=") &&
        gymHeaderQuote.includes("source=landing_"),
      `gimnasios header CTA must preserve quote context: ${gymHeaderQuote}`,
    );
    await page.evaluate(() => globalThis.document.fonts.ready);
    const gymHeadingFits = await page
      .locator(".builder-heading h1")
      .evaluate((heading) => heading.scrollWidth <= heading.clientWidth + 1);
    assert(gymHeadingFits, "Gym landing headline must not be painted underneath its gallery.");
    await runAxe(page, "gimnasios");
    await assertThemeSwitch(page, "Gym landing");
    await assertWhatsappStableWhileScrolling(page, "Gym desktop landing");
    const gymWhatsappPresentation = await getWhatsappPresentation(page);

    // --- Interactive industry landings ---
    // A deliberate subset: gym, veterinary and aesthetics are covered above with
    // their own assertions. Brands come from the shared sector table.
    const industryLandings = ["agencies", "ecommerce", "real-estate", "restaurants"].map((id) => {
      const sector = getSector(id);
      return [sector.id, sector.brand];
    });
    for (const [slug, brand] of industryLandings) {
      await page.goto(`${baseUrl}/${slug}`, { waitUntil: "domcontentloaded" });
      await expectVisibleText(page, brand, `${slug} brand`);
      const landingHeaderQuote = await page
        .locator("header [data-quote-cta]")
        .first()
        .getAttribute("href");
      assert(
        landingHeaderQuote?.startsWith("/cotizacion?") &&
          landingHeaderQuote.includes("sector=") &&
          landingHeaderQuote.includes("demo=") &&
          landingHeaderQuote.includes("service=") &&
          landingHeaderQuote.includes("source=landing_"),
        `${slug} header CTA must preserve quote context: ${landingHeaderQuote}`,
      );
      const landingDisclosure = await page
        .locator("[data-luenio-disclosure]")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { bottom: bounds.bottom, top: bounds.top, visible: !element.hidden };
        });
      assert(
        landingDisclosure.visible &&
          landingDisclosure.top >= -1 &&
          landingDisclosure.bottom <= 800 + 1,
        `${slug} disclosure must be visible in the first desktop viewport: ${JSON.stringify(landingDisclosure)}`,
      );
      if (slug === "agencies") {
        const sharedWhatsappPresentation = await getWhatsappPresentation(page);
        // The trigger's markup, CSS and label text are identical on every landing
        // (both come from niche-landing.js) -- verified by hand across gym and
        // agencies. Only its layout width can still drift a few px between the
        // two separate navigations: shaping the variable-weight (750) Inter run
        // isn't perfectly deterministic across page loads in Playwright's
        // Chromium (reproduced identically -- 217.266 vs 220 -- across three
        // separate CI runs, but never locally against system Chrome), so the
        // tolerance allows for that while every other property stays exact.
        assert(
          gymWhatsappPresentation.background === sharedWhatsappPresentation.background &&
            gymWhatsappPresentation.borderRadius === sharedWhatsappPresentation.borderRadius &&
            gymWhatsappPresentation.font === sharedWhatsappPresentation.font &&
            gymWhatsappPresentation.height === sharedWhatsappPresentation.height &&
            gymWhatsappPresentation.labelDisplay === sharedWhatsappPresentation.labelDisplay &&
            gymWhatsappPresentation.paddingInline === sharedWhatsappPresentation.paddingInline &&
            Math.abs(gymWhatsappPresentation.width - sharedWhatsappPresentation.width) <= 3,
          `Gym desktop WhatsApp must use the shared landing presentation: ${JSON.stringify({
            gym: gymWhatsappPresentation,
            shared: sharedWhatsappPresentation,
          })}`,
        );
      }
      const choice = page.locator("[data-demo-choice]:not(.is-selected)").first();
      if ((await choice.count()) > 0) {
        const choiceValue = await choice.getAttribute("data-demo-choice");
        await choice.click();
        const selectedChoice = page.locator(`[data-demo-choice="${choiceValue}"]`);
        assert(
          (await selectedChoice.getAttribute("aria-pressed")) === "true",
          `${slug} interactive choice must expose its selected state.`,
        );
        // Un objetivo que la interacción inventa fuera de `goalOptions` no llega
        // al flujo de cotización: `buildQuoteUrl` lo descarta y el enlace pierde
        // su contexto sin decir nada. Se comprueba después de elegir, que es
        // cuando el guion de la demo escribe el objetivo nuevo.
        const goalAfterChoice = await page
          .locator("[data-quote-link]")
          .first()
          .getAttribute("href");
        assert(
          goalAfterChoice?.includes("goal="),
          `${slug} interactive choice must keep a canonical goal on the quote link: ${goalAfterChoice}`,
        );
      }
      await runAxe(page, slug);
      await assertThemeSwitch(page, `${slug} landing`);
    }

    // --- Care-sector landing coverage ---
    const careLandings = [
      ["veterinarias", "Huella Veterinaria"],
      ["esteticas", "Aura Estética"],
    ];
    for (const [slug, brand] of careLandings) {
      await page.goto(`${baseUrl}/${slug}`, { waitUntil: "domcontentloaded" });
      await expectVisibleText(page, brand, `${slug} brand`);
      const careHeaderQuote = await page
        .locator("header [data-quote-cta]")
        .first()
        .getAttribute("href");
      assert(
        careHeaderQuote?.startsWith("/cotizacion?") &&
          careHeaderQuote.includes("sector=") &&
          careHeaderQuote.includes("demo=") &&
          careHeaderQuote.includes("service=") &&
          careHeaderQuote.includes("source=landing_"),
        `${slug} header CTA must preserve quote context: ${careHeaderQuote}`,
      );
      const careDesktopDisclosure = await page
        .locator("[data-luenio-disclosure]")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { bottom: bounds.bottom, top: bounds.top, visible: !element.hidden };
        });
      assert(
        careDesktopDisclosure.visible &&
          careDesktopDisclosure.top >= -1 &&
          careDesktopDisclosure.bottom <= 800 + 1,
        `${slug} disclosure must be visible in the first desktop viewport: ${JSON.stringify(careDesktopDisclosure)}`,
      );
      await runAxe(page, slug);
      await assertThemeSwitch(page, `${slug} landing`);
      await page.setViewportSize({ width: 390, height: 844 });
      const careViewport = await page.evaluate(() => ({
        clientWidth: globalThis.document.documentElement.clientWidth,
        scrollWidth: globalThis.document.documentElement.scrollWidth,
      }));
      assert(
        careViewport.scrollWidth <= careViewport.clientWidth + 1,
        `${slug} must not overflow horizontally on mobile: ${JSON.stringify(careViewport)}`,
      );
      // Counted by what the control does, not by the class it wears: `.care-pill`
      // belongs to the shared care template, so pinning it here made the check
      // fail the moment a sector got a world of its own -- which is the point of
      // the redesign, not a regression.
      const careConversionPaths = await page
        .locator('[data-luenio-open], a[href^="/cotizacion"]')
        .count();
      assert(
        careConversionPaths >= 2,
        `${slug} must expose multiple clear conversion paths: found ${careConversionPaths}.`,
      );
      const careDisclosure = await page
        .locator("[data-luenio-disclosure]")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { bottom: bounds.bottom, top: bounds.top, visible: !element.hidden };
        });
      assert(
        careDisclosure.visible && careDisclosure.top >= -1 && careDisclosure.bottom <= 844 + 1,
        `${slug} disclosure must be visible in the first mobile viewport: ${JSON.stringify(careDisclosure)}`,
      );
      await page.setViewportSize({ width: 1280, height: 800 });
    }

    // --- Conversion continuity: hero choice -> form -> explicit demo outcome ---
    await page.goto(`${baseUrl}/agencies`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-demo-choice="Posicionar"]').click();
    await page.locator('[data-demo-choice="Campaña"]').click();
    assert((await page.locator("[data-agency-goal]").inputValue()) === "Posicionar");
    assert((await page.locator("[data-agency-channel]").inputValue()) === "Campaña");
    const agencyForm = page.locator("[data-demo-form]");
    await agencyForm.getByLabel("Nombre", { exact: true }).fill("Persona Demo");
    await agencyForm.getByLabel("Empresa", { exact: true }).fill("Empresa Demo");
    await agencyForm.getByRole("button", { name: "Probar solicitud de propuesta" }).click();
    await expectVisibleText(page, "Solicitud de propuesta simulada", "agency conversion outcome");

    await page.goto(`${baseUrl}/ecommerce`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-demo-choice="Audio"]').click();
    assert(
      (await page.locator("[data-commerce-inquiry-product]").inputValue()) === "Nova Sonic Pro",
      "Ecommerce recommendation must prefill the matching product.",
    );
    const ecommerceForm = page.locator("[data-demo-form]");
    await ecommerceForm.getByLabel("Correo electrónico", { exact: true }).fill("demo@luenio.com");
    await ecommerceForm.getByRole("button", { name: "Probar consulta" }).click();
    await expectVisibleText(page, "Consulta de producto simulada", "ecommerce conversion outcome");

    await page.goto(`${baseUrl}/real-estate`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-demo-choice="Chicó"]').click();
    await page.locator('[data-demo-choice="Inversión"]').click();
    assert((await page.locator("[data-property-zone]").inputValue()) === "Chicó");
    assert((await page.locator("[data-property-intent]").inputValue()) === "Inversión");
    const realEstateForm = page.locator("[data-demo-form]");
    await realEstateForm.getByLabel("Nombre", { exact: true }).fill("Persona Demo");
    await realEstateForm.getByLabel("Correo electrónico", { exact: true }).fill("demo@luenio.com");
    await realEstateForm.getByRole("button", { name: "Probar solicitud de asesoría" }).click();
    await expectVisibleText(
      page,
      "Solicitud de asesoría simulada",
      "real-estate conversion outcome",
    );

    await page.goto(`${baseUrl}/restaurants`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-demo-choice="Celebración"]').click();
    await page.locator('[data-demo-choice="21:30"]').click();
    assert((await page.locator("[data-restaurant-occasion]").inputValue()) === "Celebración");
    assert((await page.locator("[data-restaurant-form-time]").inputValue()) === "21:30");
    const restaurantForm = page.locator("[data-demo-form]");
    await restaurantForm.getByLabel("Nombre", { exact: true }).fill("Persona Demo");
    await restaurantForm.getByLabel("Fecha", { exact: true }).fill("2026-08-15");
    await restaurantForm.getByRole("button", { name: "Probar solicitud de reserva" }).click();
    await expectVisibleText(page, "Solicitud de reserva simulada", "restaurant conversion outcome");

    await page.goto(`${baseUrl}/gym`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => globalThis.document.documentElement.dataset.gymDemoReady === "true",
    );
    await page.locator("[data-confirm-route]").click();
    const bookingDialog = page.locator("[data-booking-dialog]");
    await bookingDialog.getByLabel("Nombre", { exact: true }).fill("Persona Demo");
    await bookingDialog.getByLabel("WhatsApp", { exact: true }).fill("3001234567");
    await bookingDialog.locator("form").evaluate((form) => {
      const submitter = form.querySelector("[data-simulate-booking]");
      if (form.tagName !== "FORM" || submitter?.tagName !== "BUTTON") {
        throw new Error("Gym booking form is not ready.");
      }
      form.requestSubmit(submitter);
    });
    await page.waitForFunction(
      () => globalThis.document.documentElement.dataset.bookingState === "confirmed",
    );
    await expectVisibleText(page, "Reserva simulada confirmada", "gym conversion outcome");

    const responsiveIndustryLandings = [...industryLandings, ["gym", "Titan Fitness Club"]];
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [slug, brand] of responsiveIndustryLandings) {
      await page.goto(`${baseUrl}/${slug}`, { waitUntil: "domcontentloaded" });
      await expectVisibleText(page, brand, `${slug} mobile brand`);
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            globalThis.dispatchEvent(new Event("resize"));
            globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve));
          }),
      );
      const mobileLayout = await page.evaluate(() => {
        const heading = globalThis.document.querySelector("main h1");
        const actions = globalThis.document.querySelector(".demo-actions");
        const collisionZone = globalThis.document.querySelector("[data-luenio-collision-zone]");
        const whatsapp = globalThis.document.querySelector(".luenio-wa__trigger");
        const headingRange = globalThis.document.createRange();
        if (heading) headingRange.selectNodeContents(heading);
        const headingRect = heading ? headingRange.getBoundingClientRect() : null;
        const actionsRect = actions?.getBoundingClientRect();
        const zoneRect = collisionZone?.getBoundingClientRect();
        const whatsappRect = whatsapp?.getBoundingClientRect();
        const overlapWidth =
          zoneRect && whatsappRect
            ? Math.max(
                0,
                Math.min(zoneRect.right, whatsappRect.right) -
                  Math.max(zoneRect.left, whatsappRect.left),
              )
            : 0;
        const overlapHeight =
          zoneRect && whatsappRect
            ? Math.max(
                0,
                Math.min(zoneRect.bottom, whatsappRect.bottom) -
                  Math.max(zoneRect.top, whatsappRect.top),
              )
            : 0;

        return {
          documentOverflows:
            globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
          headingClipped:
            !headingRect || headingRect.left < -1 || headingRect.right > globalThis.innerWidth + 1,
          headingBounds: headingRect
            ? { left: headingRect.left, right: headingRect.right, viewport: globalThis.innerWidth }
            : null,
          flowGap: actionsRect && zoneRect ? zoneRect.top - actionsRect.bottom : null,
          whatsappOverlapsZone: overlapWidth * overlapHeight > 1,
          whatsappHidden: whatsapp?.classList.contains("is-collision-hidden") ?? false,
        };
      });
      assert(!mobileLayout.documentOverflows, `${slug} landing must not overflow on mobile.`);
      const mobileDisclosure = await page
        .locator("[data-luenio-disclosure]")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { bottom: bounds.bottom, top: bounds.top, visible: !element.hidden };
        });
      assert(
        mobileDisclosure.visible &&
          mobileDisclosure.top >= -1 &&
          mobileDisclosure.bottom <= 844 + 1,
        `${slug} disclosure must be visible in the first mobile viewport: ${JSON.stringify(mobileDisclosure)}`,
      );
      assert(
        !mobileLayout.headingClipped,
        `${slug} hero heading must fit the mobile viewport: ${JSON.stringify(mobileLayout)}`,
      );
      assert(
        mobileLayout.flowGap === null || mobileLayout.flowGap >= 20,
        `${slug} mobile hero actions must not collide with its interactive panel.`,
      );
      assert(
        !mobileLayout.whatsappHidden,
        `${slug} WhatsApp trigger must remain available on mobile.`,
      );
    }
    await page.goto(`${baseUrl}/gym`, { waitUntil: "domcontentloaded" });
    await assertWhatsappStableWhileScrolling(page, "Gym mobile landing");
    await page.setViewportSize({ width: 1280, height: 800 });

    // --- Industry simulations connected to their landings ---
    // Identity and landing route come from the sector table; the selector is the
    // one piece that is specific to this test.
    const simulationSelectors = {
      agencies: ".agency-client-list article",
      ecommerce: ".ecommerce-inventory-list article",
      gym: ".gym-pricing-cards article",
      "real-estate": ".real-estate-property-list article",
      restaurants: ".restaurant-pipeline article",
      veterinary: "#vetServices article",
      aesthetics: "#aestheticServices article",
    };
    const industrySimulations = SECTORS.map((sector) => [
      sector.id,
      sector.brand,
      nichePath(sector),
      simulationSelectors[sector.id],
    ]);
    for (const [
      index,
      [slug, brand, landingHref, dynamicSelector],
    ] of industrySimulations.entries()) {
      await page.goto(`${baseUrl}/demo/${slug}`, { waitUntil: "domcontentloaded" });
      await expectVisibleText(page, brand, `${slug} simulation brand`);
      if (index === 0) {
        // The demo auto-starts ~650ms after load and its run button re-enables
        // ~5.1s after that (industry-demo-runtime.js's default autoStartDelay
        // and completedDelay) -- give the first page's run a chance to finish
        // so simulation_start/simulation_complete actually land in analytics
        // before the loop moves on to the next sector.
        await page.waitForFunction(
          () =>
            JSON.parse(globalThis.localStorage.getItem("luenio.analytics.events") || "[]")
              .map((event) => event.name)
              .includes("simulation_complete"),
          undefined,
          { timeout: 8_000 },
        );
      }
      const simulationDisclosure = await page
        .locator(".simulation-disclosure")
        .first()
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { bottom: bounds.bottom, top: bounds.top, visible: !element.hidden };
        });
      assert(
        simulationDisclosure.visible &&
          simulationDisclosure.top >= -1 &&
          simulationDisclosure.bottom <= 800 + 1,
        `${slug} simulation disclosure must be visible in the first desktop viewport: ${JSON.stringify(simulationDisclosure)}`,
      );
      await page.locator(dynamicSelector).first().waitFor({ state: "visible", timeout: 10_000 });
      assert(
        (await page.locator(`.simulation-nav__brand a[href="${landingHref}"]`).count()) === 1,
        `${slug} simulation must link back to its landing.`,
      );
      assert(
        (await page.locator('#industryLinks a[aria-current="page"]').count()) === 1,
        `${slug} simulation must identify the active industry.`,
      );
      const simulationQuote = page.locator("[data-simulation-quote]");
      const simulationWhatsapp = page.locator("[data-simulation-whatsapp]");
      assert(
        (await simulationQuote.count()) === 1 &&
          (await simulationQuote.getAttribute("href")).startsWith("/cotizacion?"),
        `${slug} simulation must preserve context into the quote flow.`,
      );
      assert(
        (await simulationWhatsapp.count()) === 1 &&
          (await simulationWhatsapp.getAttribute("href")).startsWith("https://wa.me/"),
        `${slug} simulation must offer a direct contextual WhatsApp exit.`,
      );
      assert(
        (await page.locator("#industryLinks a").count()) === 7,
        `${slug} simulation selector must expose all seven sectors.`,
      );
      const resourceState = page.locator(".simulation-resource-state");
      assert(
        (await resourceState.count()) === 1 &&
          (await resourceState.getAttribute("hidden")) !== null,
        `${slug} simulation must keep its resource error state hidden when assets load.`,
      );
      await runAxe(page, `${slug}-simulation`);
    }
    const simulationEvents = await page.evaluate(() =>
      JSON.parse(globalThis.localStorage.getItem("luenio.analytics.events") || "[]").map(
        (event) => event.name,
      ),
    );
    assert(
      simulationEvents.includes("simulation_start") &&
        simulationEvents.includes("simulation_complete"),
      `Simulation analytics must cover start and completion: ${simulationEvents.join(", ")}`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    for (const [slug, brand] of industrySimulations) {
      await page.goto(`${baseUrl}/demo/${slug}`, { waitUntil: "commit", timeout: 10_000 });
      await expectVisibleText(page, brand, `${slug} mobile simulation brand`);
      await page.locator("main h1").waitFor({ state: "visible", timeout: 10_000 });
      // The sector links in #industryLinks are a horizontal scroller whose item
      // widths change when the custom font swaps in. Measuring scrollWidth before
      // that lands makes this overflow assertion intermittently fail.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const done = () => resolve();
            Promise.resolve(globalThis.document.fonts?.ready).then(done, done);
            globalThis.setTimeout(done, 3_000);
          }),
      );
      await page.waitForFunction(
        () => {
          const link = globalThis.document.querySelector('#industryLinks a[aria-current="page"]');
          if (!link) return false;
          const bounds = link.getBoundingClientRect();
          return bounds.left >= -1 && bounds.right <= globalThis.innerWidth + 1;
        },
        undefined,
        { timeout: 3_000 },
      );
      const activeIndustryVisible = await page
        .locator('#industryLinks a[aria-current="page"]')
        .evaluate((link) => {
          const bounds = link.getBoundingClientRect();
          return bounds.left >= -1 && bounds.right <= globalThis.innerWidth + 1;
        });
      assert(
        activeIndustryVisible,
        `${slug} mobile simulation must reveal its active industry navigation item.`,
      );
      const mobileLayout = await page.evaluate(() => {
        const documentElement = globalThis.document.documentElement;
        const offenders = [...globalThis.document.querySelectorAll("*")]
          .map((element) => ({
            element,
            right: element.getBoundingClientRect().right,
            left: element.getBoundingClientRect().left,
            width: element.getBoundingClientRect().width,
          }))
          .filter(({ element, right, left, width }) => {
            const style = globalThis.getComputedStyle(element);
            return (
              width > 0 &&
              (right > globalThis.innerWidth + 1 || left < -1) &&
              style.position !== "fixed" &&
              style.position !== "sticky"
            );
          })
          .sort((first, second) => second.right - first.right)
          .slice(0, 5)
          .map(({ element, right, left, width }) => ({
            className: String(element.className || "").slice(0, 120),
            id: element.id,
            left: Math.round(left * 10) / 10,
            right: Math.round(right * 10) / 10,
            tag: element.tagName.toLowerCase(),
            width: Math.round(width * 10) / 10,
          }));
        return {
          clientWidth: documentElement.clientWidth,
          offenders,
          scrollWidth: documentElement.scrollWidth,
        };
      });
      assert(
        mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1,
        `${slug} simulation must not overflow horizontally on mobile: ${JSON.stringify(mobileLayout)}`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 800 });

    // --- Login (public CRM gate) ---
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "Bienvenido de nuevo.", "login heading");
    const email = page.locator('input[name="email"], input[type="email"]').first();
    const password = page.locator('input[name="password"], input[type="password"]').first();
    await email.waitFor({ state: "visible" });
    await password.waitFor({ state: "visible" });
    assert(
      (await email.getAttribute("autocomplete")) === "username",
      "Login identifier must autocomplete=username",
    );
    assert(
      (await password.getAttribute("autocomplete")) === "current-password",
      "Password must autocomplete=current-password",
    );
    await page.locator("#authForm button[type='submit'], #authForm button").first().click();
    // HTML5 validation or app message should keep us on login
    assert(page.url().includes("/login"), "Empty login submit must stay on /login");
    await runAxe(page, "login");

    // --- Dashboard requires session ---
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const urlAfterDashboard = page.url();
    const bodyText = await page.locator("body").innerText();
    const gated =
      urlAfterDashboard.includes("/login") ||
      /verificando sesi[oó]n|accede|iniciar sesi[oó]n|espacio de trabajo/i.test(bodyText);
    assert(gated, "Unauthenticated /dashboard must redirect to login or show session gate.");

    // If we landed on admin shell without session, still scan a11y of what rendered
    if (urlAfterDashboard.includes("/login")) {
      await runAxe(page, "dashboard-redirect-login");
    } else {
      await runAxe(page, "dashboard-unauthenticated");
    }

    // --- Legal ---
    await page.goto(`${baseUrl}/privacidad`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "Privacidad", "privacy page");
    await runAxe(page, "privacidad");

    // No fatal pageerrors on critical paths (allow network/font noise filtered above)
    const fatal = browserErrors.filter(
      (message) =>
        !/favicon|fonts\.gstatic|Failed to load resource.*(?:401|403|404)|console: Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED/i.test(
          message,
        ),
    );
    assert(fatal.length === 0, `Unexpected page errors:\n${fatal.join("\n")}`);

    console.info("[browser-e2e] Browser smoke + a11y checks passed");
  } finally {
    await context.close();
    await browser.close();
  }
}

function restoreLocalDb() {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

const { baseUrl, stop } = await startServer();
try {
  await runBrowserChecks(baseUrl);
} finally {
  await stop();
  restoreLocalDb();
}
