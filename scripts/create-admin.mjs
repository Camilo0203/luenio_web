/**
 * Bootstrap first admin user (local JSON DB or Supabase service role).
 *
 *   npm run auth:create-admin -- --email you@luenio.com --password 'YourLongPass1!' --name 'Luenio'
 *
 * Loads .env from project root (same as server.js).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const { createUser } = await import("../api/services/auth-service.js");

function arg(name, fallback = "") {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

const email = arg("email");
const password = arg("password");
const businessName = arg("name", "Luenio");
const plan = arg("plan", "starter");

if (!email || !password) {
  console.error(
    "Usage: npm run auth:create-admin -- --email a@b.com --password 'min12chars' [--name Company]",
  );
  process.exit(1);
}

try {
  const user = await createUser({
    email,
    password,
    businessName,
    plan,
    role: "admin",
  });
  console.info("Admin created:", {
    id: user.id,
    email: user.email,
    role: user.role,
    businessName: user.businessName,
  });
  console.info("Next: open Acceso clientes on the site, sign in, choose Espacio.");
  console.info("Prod: set ADMIN_MFA_REQUIRED + MFA webhook; TURNSTILE_REQUIRED for login widget.");
} catch (err) {
  console.error("Failed:", err?.message || err);
  process.exit(1);
}
