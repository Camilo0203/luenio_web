import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listFiles(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    return absolutePath;
  });
}

const localDbExamplePath = path.join(root, "db", "leads-db.example.json");
const localDbRuntimePath = path.join(root, "db", "leads-db.json");

function assertEmptyLocalDatabase(filePath, label) {
  const database = JSON.parse(fs.readFileSync(filePath, "utf8"));
  [
    "users",
    "leads",
    "events",
    "actions",
    "notifications",
    "subscriptions",
    "inquiries",
  ].forEach((collection) => {
    assert(Array.isArray(database[collection]), `${label} ${collection} must be an array.`);
    assert(database[collection].length === 0, `${label} ${collection} must not contain real tenant data.`);
  });
}

assert(fs.existsSync(localDbExamplePath), "Local DB example must exist.");
assertEmptyLocalDatabase(localDbExamplePath, "Local DB example");
if (fs.existsSync(localDbRuntimePath)) {
  assertEmptyLocalDatabase(localDbRuntimePath, "Local DB runtime fallback");
}

const sensitivePatterns = [
  {
    pattern: /\b\d{10,15}\b/g,
    label: "long phone-like number",
    allow: (match, filePath) => (
      filePath.endsWith(path.join("scripts", "e2e.mjs"))
      || filePath.endsWith(path.join("scripts", "readiness-test.mjs"))
      || filePath.endsWith(path.join("scripts", "auth-security-test.mjs"))
      || match.startsWith("1000000")
      || match === "31536000"
    ),
  },
  {
    pattern: /sk_live_[A-Za-z0-9_]+/g,
    label: "live Stripe secret key",
    allow: () => false,
  },
  {
    pattern: /whsec_(?!your_|ready|luenio_local_test_secret)[A-Za-z0-9_]+/g,
    label: "non-placeholder Stripe webhook secret",
    allow: () => false,
  },
];

const mojibakePatterns = ["\u00c3", "\u00c2", "\u00ef\u00bf\u00bd", "\uFFFD"];

for (const filePath of listFiles()) {
  const relativePath = path.relative(root, filePath);
  const extension = path.extname(filePath);
  if (![".html", ".css", ".js", ".json", ".md", ".sql", ".example", ""].includes(extension)) continue;

  const source = fs.readFileSync(filePath, "utf8");
  mojibakePatterns.forEach((pattern) => {
    assert(!source.includes(pattern), `${relativePath} contains mojibake/encoding artifact: ${pattern}`);
  });

  for (const { pattern, label, allow } of sensitivePatterns) {
    for (const match of source.matchAll(pattern)) {
      if (allow(match[0], relativePath)) continue;
      throw new Error(`${relativePath} contains ${label}: ${match[0]}`);
    }
  }
}

console.info("Data hygiene guard passed");
