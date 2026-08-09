#!/usr/bin/env node
/**
 * Verifies CRM migration + seed against an in-process PGlite Postgres
 * (same SQL as Neon). Use when Neon OAuth is not yet completed.
 * Does NOT replace production Neon — only validates SQL integrity.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const db = new PGlite();
  await db.exec("SELECT 1");
  // Polyfill gen_random_uuid for environments without pgcrypto
  await db.exec(`
    CREATE OR REPLACE FUNCTION gen_random_uuid()
    RETURNS uuid
    LANGUAGE sql
    AS $$ SELECT md5(random()::text || clock_timestamp()::text)::uuid $$;
  `);

  const migDir = join(root, "db", "migrations");
  for (const file of readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    console.log("apply", file);
    await db.exec(readFileSync(join(migDir, file), "utf8"));
  }

  const seedDir = join(root, "db", "seeds");
  for (const file of readdirSync(seedDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    console.log("seed", file);
    await db.exec(readFileSync(join(seedDir, file), "utf8"));
  }

  const checks = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM clients) AS clients,
      (SELECT COUNT(*)::int FROM leads) AS leads,
      (SELECT COUNT(*)::int FROM projects) AS projects,
      (SELECT COUNT(*)::int FROM invoices) AS invoices,
      (SELECT COUNT(*)::int FROM metrics_snapshots) AS metrics
  `);

  const row = checks.rows[0];
  console.log("counts", row);

  const pipeline = await db.query(`
    SELECT stage, COUNT(*)::int AS n FROM leads GROUP BY stage ORDER BY stage
  `);
  console.log("pipeline", pipeline.rows);

  const mrr = await db.query(`
    SELECT month, mrr FROM metrics_snapshots ORDER BY month
  `);
  console.log("mrr series", mrr.rows);

  if (row.users < 1 || row.clients < 1 || row.leads < 1 || row.metrics < 1) {
    throw new Error("Seed counts too low — verification failed");
  }

  console.log("✓ Schema + seed verified on PGlite (Neon-compatible SQL)");
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
