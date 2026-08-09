import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = valueParts
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const { buildReadiness } = await import("../config/readiness.js");

const readiness = buildReadiness();
const pad = (value, width) => String(value).padEnd(width);

console.info("Luenio readiness report");
console.info("=".repeat(72));
console.info(`ready: ${readiness.ready} | criticalReady: ${readiness.criticalReady}`);
console.info("-".repeat(72));
console.info(`${pad("STATUS", 8)} ${pad("SEV", 12)} ${pad("ID", 28)} LABEL`);
console.info("-".repeat(72));

for (const check of readiness.checks) {
  const status = check.done ? "OK" : "MISSING";
  console.info(`${pad(status, 8)} ${pad(check.severity, 12)} ${pad(check.id, 28)} ${check.label}`);
  if (!check.done) {
    console.info(`         → ${check.description}`);
  }
}

console.info("-".repeat(72));
console.info(
  readiness.criticalReady
    ? "Critical checks satisfied for this environment."
    : "Critical checks incomplete — do not launch publicly.",
);

process.exitCode = readiness.criticalReady ? 0 : 1;
