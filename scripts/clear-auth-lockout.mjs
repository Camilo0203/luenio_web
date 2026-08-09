/**
 * Clear auth lockouts (throttles) for an email so the user can try login again.
 *
 *   node scripts/clear-auth-lockout.mjs --email meltrinox@gmail.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

const emailArgIdx = process.argv.indexOf("--email");
const email = (emailArgIdx >= 0 ? process.argv[emailArgIdx + 1] : "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/clear-auth-lockout.mjs --email user@example.com");
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

// Delete all auth_throttles (dev helper). For targeted clear we'd need the same hash secret.
const res = await fetch(`${url}/rest/v1/auth_throttles?key_hash=not.is.null`, {
  method: "DELETE",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "return=minimal",
  },
});

console.log("clear throttles status", res.status);
console.log("Done. User can try login again:", email);
console.log("(Cleared all auth_throttles rows — use only in staging/dev.)");
