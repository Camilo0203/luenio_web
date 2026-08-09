#!/usr/bin/env node
/**
 * Apply versioned CRM migrations + optional seed against Neon DATABASE_URL.
 * Usage:
 *   node scripts/db-migrate.mjs
 *   node scripts/db-migrate.mjs --seed
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const withSeed = process.argv.includes("--seed");

const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL / NEON_DATABASE_URL is not set.");
  console.error("1) npx neonctl@latest auth");
  console.error("2) npx neonctl@latest projects create --name luenio-crm");
  console.error("3) npx neonctl@latest connection-string --project-id <id> > set DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);

async function runSqlFile(path) {
  const raw = readFileSync(path, "utf8");
  // Neon HTTP driver: one statement per request (no multi-request transactions).
  // Strip BEGIN/COMMIT so DDL is auto-committed per statement.
  const statements = splitSql(raw);
  for (const stmt of statements) {
    // Strip leading full-line SQL comments so "-- header\nCREATE TABLE" is not skipped
    let trimmed = stmt.replace(/^\s*--[^\n]*\n/gm, "").trim();
    if (!trimmed || /^--/.test(trimmed)) continue;
    // Drop pure transaction control (cross-request BEGIN/COMMIT is invalid on HTTP)
    if (/^(BEGIN|COMMIT|ROLLBACK)\s*;?$/i.test(trimmed)) continue;
    if (
      /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed) &&
      !/\b(DO|CREATE|ALTER|INSERT|UPDATE|DELETE|SELECT|TRUNCATE)\b/i.test(trimmed)
    ) {
      continue;
    }
    try {
      await sql.query(trimmed);
    } catch (err) {
      const preview = trimmed.replace(/\s+/g, " ").slice(0, 120);
      console.error(`    FAIL: ${preview}`);
      throw err;
    }
  }
}

function splitSql(input) {
  const parts = [];
  let current = "";
  let dollarTag = null; // e.g. "$$" or "$body$"
  let inSingle = false;
  let inLineComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }

    // Dollar-quoted strings ($tag$ ... $tag$)
    if (!inSingle && dollarTag === null && ch === "$") {
      const m = input.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (m) {
        dollarTag = m[0];
        current += m[0];
        i += m[0].length - 1;
        continue;
      }
    } else if (!inSingle && dollarTag !== null && input.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length - 1;
      dollarTag = null;
      continue;
    }

    if (dollarTag !== null) {
      current += ch;
      continue;
    }

    // Line comments
    if (!inSingle && ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }

    // Single-quoted strings ('' escape)
    if (ch === "'") {
      current += ch;
      if (inSingle && next === "'") {
        current += next;
        i++;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }

    if (ch === ";" && !inSingle) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

async function main() {
  console.log("→ Connecting to Neon…");
  await sql`SELECT 1`;

  // migrations bookkeeping
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migDir = join(root, "db", "migrations");
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const applied = await sql`SELECT 1 FROM schema_migrations WHERE id = ${id}`;
    if (applied.length) {
      console.log(`  skip ${file} (already applied)`);
      continue;
    }
    console.log(`  apply ${file}`);
    await runSqlFile(join(migDir, file));
    await sql`INSERT INTO schema_migrations (id) VALUES (${id})`;
  }

  if (withSeed) {
    const seedDir = join(root, "db", "seeds");
    const seeds = readdirSync(seedDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of seeds) {
      console.log(`  seed ${file}`);
      await runSqlFile(join(seedDir, file));
    }
  }

  console.log("✓ Done");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
