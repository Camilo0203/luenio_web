/**
 * Guards the JSON-LD the public pages publish.
 *
 * Structured data fails silently: a trailing comma, a renamed page or an `@id`
 * that points at a node nobody defines all keep the site looking fine while a
 * search engine quietly drops the markup. The gate had no check for it, so this
 * one runs the three questions that catch those.
 *
 * 1. Every block parses, and every node declares a type schema.org knows.
 * 2. Every `@id` referenced somewhere is defined somewhere, site-wide. Nodes are
 *    split across pages on purpose — the guides point their publisher at the
 *    organization the home page declares — so the check is global, not per file.
 * 3. Every page in the sitemap carries a canonical that matches its own URL.
 */

import fs from "node:fs";
import path from "node:path";
import { canonicalPublicPaths } from "../lib/public-routes.js";

const root = process.cwd();
const SITE = "https://luenio.com";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function publicPageFiles() {
  const directory = path.join(root, "apps", "web", "pages");
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") files.push(full);
    }
  };
  walk(directory);
  return files;
}

/** Types the site is allowed to publish. A new one is a deliberate decision. */
const KNOWN_TYPES = new Set([
  "Answer",
  "Article",
  "BreadcrumbList",
  "CollectionPage",
  "ContactPoint",
  "Country",
  "FAQPage",
  "ItemList",
  "ListItem",
  "Offer",
  "OfferCatalog",
  "Organization",
  "PostalAddress",
  "ProfessionalService",
  "Question",
  "Service",
  "WebPage",
  "WebSite",
]);

const defined = new Set();
const referenced = new Map();
let nodeCount = 0;
let blockCount = 0;

function visit(value, file) {
  if (Array.isArray(value)) {
    for (const entry of value) visit(entry, file);
    return;
  }
  if (!value || typeof value !== "object") return;

  const keys = Object.keys(value);
  const id = value["@id"];
  const isReferenceOnly = id && keys.length === 1;

  if (id) {
    if (isReferenceOnly) {
      if (!referenced.has(id)) referenced.set(id, file);
    } else {
      defined.add(id);
    }
  }

  if (value["@type"]) {
    nodeCount += 1;
    for (const type of [].concat(value["@type"])) {
      assert(
        KNOWN_TYPES.has(type),
        `${file}: unknown schema.org type "${type}". Add it to KNOWN_TYPES if it is intended.`,
      );
    }
  }

  for (const key of keys) {
    if (key === "@context" || key === "@type" || key === "@id") continue;
    visit(value[key], file);
  }
}

for (const file of publicPageFiles()) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const html = fs.readFileSync(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const [, body] of blocks) {
    blockCount += 1;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      throw new Error(`${relative}: JSON-LD does not parse. ${error.message}`);
    }
    assert(
      parsed["@context"] === "https://schema.org",
      `${relative}: JSON-LD must declare "@context": "https://schema.org".`,
    );
    visit(parsed["@graph"] ?? parsed, relative);
  }
}

for (const [id, file] of referenced) {
  assert(
    defined.has(id),
    `${file}: references "${id}" but no page defines that node. A reference-only @id must resolve.`,
  );
}

// Every indexable page points its canonical at its own address.
for (const route of canonicalPublicPaths()) {
  const expected = route === "/" ? `${SITE}/` : `${SITE}${route}`;
  const candidates = [
    path.join(root, "apps", "web", "pages", route.slice(1), "index.html"),
    ...(route === "/" ? [path.join(root, "apps", "web", "pages", "home", "index.html")] : []),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) continue; // Routes whose directory name differs are covered by the smoke test.
  const html = fs.readFileSync(file, "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert(canonical === expected, `${route}: canonical is "${canonical}", expected "${expected}".`);
}

console.log(
  `Structured data passed: ${blockCount} blocks, ${nodeCount} nodes, ${defined.size} ids defined, ${referenced.size} referenced.`,
);
