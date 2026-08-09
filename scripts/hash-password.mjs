/**
 * Generate an app-compatible password hash for Supabase bootstrap.
 * Usage (from project root):
 *   node scripts/hash-password.mjs "YourPasswordHere"
 */
import { createPasswordHash } from "../api/services/auth-service.js";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: node scripts/hash-password.mjs "YourPasswordHere"');
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const hash = await createPasswordHash(password);
console.log(hash);
