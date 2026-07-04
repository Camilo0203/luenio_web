import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

const pages = [
  {
    slug: "gym",
    demo: "/demo/gym",
    hook: "Estás perdiendo membresías",
    primaryCta: "See how many sales you're missing",
    niche: ["membresías", "WhatsApp", "visita"],
  },
  {
    slug: "restaurants",
    demo: "/demo/restaurants",
    hook: "pedido perdido",
    primaryCta: "See how many sales you're missing",
    niche: ["pedidos", "reservas", "menú"],
  },
  {
    slug: "real-estate",
    demo: "/demo/real-estate",
    hook: "asesores pierden tiempo",
    primaryCta: "See how many sales you're missing",
    niche: ["compradores", "presupuesto", "asesor"],
  },
  {
    slug: "ecommerce",
    demo: "/demo/ecommerce",
    hook: "chats que parecían simples preguntas",
    primaryCta: "See how many sales you're missing",
    niche: ["abandonados", "producto", "checkout"],
  },
  {
    slug: "agencies",
    demo: "/demo/agencies",
    hook: "puede vender la solución",
    primaryCta: "See how many sales you're missing",
    niche: ["clientes", "revender", "servicio recurrente"],
  },
];

pages.forEach(({ slug, demo, hook, primaryCta, niche }) => {
  const pagePath = `apps/web/pages/${slug}/index.html`;
  assert(fs.existsSync(path.join(root, pagePath)), `Missing niche landing page: ${pagePath}`);

  const html = readText(pagePath);
  assert(html.includes("niche-page"), `${slug} page must use the niche landing design system.`);
  assert(html.includes(hook), `${slug} page must open with an industry-specific emotional hook.`);
  assert(
    html.includes("You're losing customers right now without noticing."),
    `${slug} page must create immediate urgency and loss awareness.`,
  );
  assert(html.includes(primaryCta), `${slug} page must include an action-oriented primary CTA.`);
  assert(
    html.includes("See the live system"),
    `${slug} page must include a live-system demo preview CTA.`,
  );
  assert(
    html.includes("Activate this for my business"),
    `${slug} page must include the final conversion CTA.`,
  );
  assert(!html.includes("Ver demo en vivo"), `${slug} page must not use passive view-demo CTAs.`);
  assert(
    !html.includes("Ver cómo funciona"),
    `${slug} page must not use passive exploration CTAs.`,
  );
  assert(html.includes(`href="${demo}"`), `${slug} page must link directly to ${demo}.`);
  assert(
    html.includes("niche-problem"),
    `${slug} page must include a pain-focused problem section.`,
  );
  assert(html.includes("Solución"), `${slug} page must include a Luenio value section.`);
  assert(
    html.includes("niche-demo-preview"),
    `${slug} page must include a live demo preview section.`,
  );
  assert(html.includes("HOT 🔥"), `${slug} page must show lead scoring visualization.`);
  assert(html.includes("Prueba social"), `${slug} page must include social proof.`);
  assert(
    html.includes("Resultado ejemplo"),
    `${slug} page must mark sample outcome metrics clearly.`,
  );
  assert(
    html.includes("Testimonio de muestra"),
    `${slug} page must mark sample testimonials clearly.`,
  );
  assert(
    niche.every((term) => html.toLowerCase().includes(term.toLowerCase())),
    `${slug} page must include niche-specific sales language.`,
  );
});

const serverSource = readText("server.js");
const viteSource = readText("vite.config.js");
["/gym", "/restaurants", "/real-estate", "/ecommerce", "/agencies"].forEach((route) => {
  assert(serverSource.includes(route), `Server must route ${route}.`);
});
["nicheGym", "nicheRestaurants", "nicheRealEstate", "nicheEcommerce", "nicheAgencies"].forEach(
  (entryName) => {
    assert(viteSource.includes(entryName), `Vite build must include ${entryName}.`);
  },
);

const css = readText("apps/web/src/style.css");
[
  ".niche-page",
  ".niche-hero",
  ".niche-loss-line",
  ".niche-preview-card",
  ".niche-final-cta",
].forEach((selector) => {
  assert(css.includes(selector), `Niche landing design system must include ${selector}.`);
});

console.info("Niche landing conversion guard passed");
