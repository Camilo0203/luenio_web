/**
 * Neon Postgres client for Luenio Agency CRM.
 * Uses @neondatabase/serverless when DATABASE_URL is set.
 * All CRM module data must flow through this client — no mock arrays.
 */

import { neon } from "@neondatabase/serverless";

let sql = null;

/**
 * @returns {import('@neondatabase/serverless').NeonQueryFunction}
 */
export function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or NEON_DATABASE_URL) is not set. Provision Neon and add the connection string to .env",
    );
  }
  sql = neon(url);
  return sql;
}

/**
 * Run a tagged template query.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
export async function query(strings, ...values) {
  const db = getSql();
  return db(strings, ...values);
}

/**
 * Health check used by ops / readiness.
 */
export async function pingDb() {
  const rows = await query`SELECT 1 AS ok`;
  return rows?.[0]?.ok === 1;
}

export default { getSql, query, pingDb };
