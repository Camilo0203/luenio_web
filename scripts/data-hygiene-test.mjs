import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    "contactDeliveries",
    "businesses",
    "memberships",
    "invitations",
    "auditLogs",
    "passwordResets",
    "sessions",
    "authThrottles",
    "authChallenges",
  ].forEach((collection) => {
    assert(Array.isArray(database[collection]), `${label} ${collection} must be an array.`);
    assert(
      database[collection].length === 0,
      `${label} ${collection} must not contain real tenant data.`,
    );
  });
}

assert(fs.existsSync(localDbExamplePath), "Local DB example must exist.");
assertEmptyLocalDatabase(localDbExamplePath, "Local DB example");

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .map((filePath) => filePath.replace(/\\/g, "/"));
const sourceFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .map((filePath) => filePath.replace(/\\/g, "/"));
assert(
  !trackedFiles.includes(path.relative(root, localDbRuntimePath).replace(/\\/g, "/")),
  "Local DB runtime fallback must remain untracked.",
);

const sensitivePatterns = [
  {
    pattern: /\b\d{10,15}\b/g,
    label: "long phone-like number",
    allow: (match, filePath) =>
      filePath.endsWith(path.join("scripts", "e2e.mjs")) ||
      filePath.endsWith(path.join("scripts", "readiness-test.mjs")) ||
      filePath.endsWith(path.join("scripts", "auth-security-test.mjs")) ||
      filePath.endsWith(path.join("scripts", "smoke-server.mjs")) ||
      filePath.endsWith(path.join("scripts", "dev-port-fallback-test.mjs")) ||
      filePath.endsWith(path.join("scripts", "production-gate.mjs")) ||
      filePath.startsWith("db/seeds/") ||
      match.startsWith("1000000") ||
      match === "31536000",
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
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    label: "private key material",
    allow: () => false,
  },
];

trackedFiles.forEach((filePath) => {
  const basename = path.posix.basename(filePath);
  const forbidden =
    (basename.startsWith(".env") &&
      ![".env.example", ".env.production.example"].includes(basename)) ||
    filePath === "db/leads-db.json" ||
    filePath.startsWith("backups/") ||
    /\.(?:pem|key|age)$/i.test(filePath);
  assert(!forbidden, `Sensitive runtime artifact must not be tracked: ${filePath}`);
});

const mojibakePatterns = ["\u00c3", "\u00c2", "\u00ef\u00bf\u00bd", "\uFFFD"];

for (const relativePath of sourceFiles) {
  if (relativePath.startsWith(".impeccable/questions/")) continue;
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const extension = path.extname(filePath);
  if (![".html", ".css", ".js", ".json", ".md", ".sql", ".example", ""].includes(extension))
    continue;

  const source = fs.readFileSync(filePath, "utf8");
  mojibakePatterns.forEach((pattern) => {
    assert(
      !source.includes(pattern),
      `${relativePath} contains mojibake/encoding artifact: ${pattern}`,
    );
  });

  for (const { pattern, label, allow } of sensitivePatterns) {
    for (const match of source.matchAll(pattern)) {
      if (allow(match[0], relativePath)) continue;
      throw new Error(`${relativePath} contains ${label}: ${match[0]}`);
    }
  }
}

console.info("Data hygiene guard passed");
