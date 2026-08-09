/**
 * Real SQL queries for CRM modules. No mock data.
 */

import { query } from "./client.js";

// ── Users ──────────────────────────────────────────────────────────────────

export async function listUsers() {
  return query`
    SELECT id, name, email, role, avatar_url, created_at
    FROM users
    ORDER BY name ASC
  `;
}

export async function getUserById(id) {
  const rows = await query`
    SELECT id, name, email, role, avatar_url, created_at
    FROM users WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

// ── Clients ────────────────────────────────────────────────────────────────

export async function listClients({ status, ownerId, search, limit = 25, offset = 0 } = {}) {
  const q = search ? `%${search}%` : null;
  return query`
    SELECT
      c.*,
      u.name AS owner_name,
      u.avatar_url AS owner_avatar
    FROM clients c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE
      (${status}::text IS NULL OR c.status::text = ${status})
      AND (${ownerId}::uuid IS NULL OR c.owner_id = ${ownerId}::uuid)
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.company ILIKE ${q}
        OR c.email ILIKE ${q}
      )
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countClients({ status, ownerId, search } = {}) {
  const q = search ? `%${search}%` : null;
  const rows = await query`
    SELECT COUNT(*)::int AS total
    FROM clients c
    WHERE
      (${status}::text IS NULL OR c.status::text = ${status})
      AND (${ownerId}::uuid IS NULL OR c.owner_id = ${ownerId}::uuid)
      AND (
        ${q}::text IS NULL
        OR c.name ILIKE ${q}
        OR c.company ILIKE ${q}
        OR c.email ILIKE ${q}
      )
  `;
  return rows[0]?.total ?? 0;
}

export async function getClientById(id) {
  const rows = await query`
    SELECT c.*, u.name AS owner_name
    FROM clients c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE c.id = ${id}
  `;
  return rows[0] ?? null;
}

// ── Leads / Pipeline ───────────────────────────────────────────────────────

export async function listLeadsByStage() {
  const rows = await query`
    SELECT
      l.*,
      c.company AS client_company,
      c.name AS client_contact,
      u.name AS owner_name,
      u.avatar_url AS owner_avatar
    FROM leads l
    LEFT JOIN clients c ON c.id = l.client_id
    LEFT JOIN users u ON u.id = l.owner_id
    ORDER BY l.stage, l.position ASC, l.updated_at DESC
  `;
  const stages = ["nuevo", "contactado", "propuesta", "negociacion", "ganado", "perdido"];
  /** @type {Record<string, typeof rows>} */
  const board = Object.fromEntries(stages.map((s) => [s, []]));
  for (const lead of rows) {
    if (board[lead.stage]) board[lead.stage].push(lead);
  }
  return board;
}

export async function getLeadById(id) {
  const rows = await query`
    SELECT
      l.*,
      c.company AS client_company,
      c.email AS client_email,
      c.phone AS client_phone,
      u.name AS owner_name
    FROM leads l
    LEFT JOIN clients c ON c.id = l.client_id
    LEFT JOIN users u ON u.id = l.owner_id
    WHERE l.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function updateLeadStage({ id, stage, position }) {
  const rows = await query`
    UPDATE leads
    SET stage = ${stage}::lead_stage,
        position = ${position}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

const LEAD_STAGES = new Set([
  "nuevo",
  "contactado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
]);

/**
 * @param {{ name: string, stage?: string, value?: number, probability?: number, client_id?: string|null, owner_id?: string|null, notes?: string }} input
 */
export async function createLead(input) {
  const name = String(input?.name || "").trim();
  if (!name) throw Object.assign(new Error("name required"), { statusCode: 400 });

  const stage = String(input?.stage || "nuevo");
  if (!LEAD_STAGES.has(stage)) {
    throw Object.assign(new Error("invalid stage"), { statusCode: 400 });
  }

  const value = Number(input?.value ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    throw Object.assign(new Error("invalid value"), { statusCode: 400 });
  }

  let probability = Number(input?.probability ?? 10);
  if (!Number.isFinite(probability)) probability = 10;
  probability = Math.max(0, Math.min(100, Math.round(probability)));

  const clientId = input?.client_id || null;
  const ownerId = input?.owner_id || null;
  const notes = String(input?.notes || "");

  // Place new cards at the top of the column
  const posRows = await query`
    SELECT COALESCE(MIN(position), 1) - 1 AS pos
    FROM leads
    WHERE stage = ${stage}::lead_stage
  `;
  const position = Number(posRows[0]?.pos ?? 0);

  const rows = await query`
    INSERT INTO leads (name, stage, value, probability, client_id, owner_id, notes, position)
    VALUES (
      ${name},
      ${stage}::lead_stage,
      ${value},
      ${probability},
      ${clientId},
      ${ownerId},
      ${notes},
      ${position}
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function pipelineSummary() {
  return query`
    SELECT
      stage,
      COUNT(*)::int AS count,
      COALESCE(SUM(value), 0)::float AS total_value,
      COALESCE(AVG(probability), 0)::float AS avg_probability
    FROM leads
    GROUP BY stage
    ORDER BY stage
  `;
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function listProjects({ status, limit = 50 } = {}) {
  return query`
    SELECT
      p.*,
      c.company AS client_company,
      c.name AS client_name,
      u.name AS owner_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE (${status}::text IS NULL OR p.status::text = ${status})
    ORDER BY
      CASE p.status WHEN 'activo' THEN 0 WHEN 'pausado' THEN 1 ELSE 2 END,
      p.start_date DESC NULLS LAST
    LIMIT ${limit}
  `;
}

// ── Invoices ───────────────────────────────────────────────────────────────

export async function listInvoices({ status, limit = 25, offset = 0 } = {}) {
  return query`
    SELECT
      i.*,
      c.company AS client_company,
      c.name AS client_name,
      p.name AS project_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE (${status}::text IS NULL OR i.status::text = ${status})
    ORDER BY i.issue_date DESC, i.number DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function invoiceTotalsByStatus() {
  return query`
    SELECT
      status,
      COUNT(*)::int AS count,
      COALESCE(SUM(amount), 0)::float AS total
    FROM invoices
    GROUP BY status
  `;
}

// ── Metrics ────────────────────────────────────────────────────────────────

export async function listMetricsSnapshots(months = 6) {
  return query`
    SELECT id, month, mrr, new_mrr, churned_mrr, active_clients_count, created_at
    FROM metrics_snapshots
    ORDER BY month DESC
    LIMIT ${months}
  `;
}

export async function dashboardMetrics() {
  const [
    snapshots,
    pipeline,
    openInvoices,
    activeProjectsCount,
    activeClients,
    topDeals,
    invoicesAtRisk,
    activeProjects,
    recentLeads,
  ] = await Promise.all([
    listMetricsSnapshots(6),
    pipelineSummary(),
    query`
      SELECT COALESCE(SUM(amount), 0)::float AS open_amount,
             COUNT(*)::int AS open_count
      FROM invoices
      WHERE status IN ('enviada', 'vencida')
    `,
    query`
      SELECT COUNT(*)::int AS count
      FROM projects WHERE status = 'activo'
    `,
    query`
      SELECT COUNT(*)::int AS count
      FROM clients WHERE status = 'activo'
    `,
    query`
      SELECT
        l.id, l.name, l.stage, l.value, l.probability, l.expected_close_date,
        c.company AS client_company,
        u.name AS owner_name
      FROM leads l
      LEFT JOIN clients c ON c.id = l.client_id
      LEFT JOIN users u ON u.id = l.owner_id
      WHERE l.stage NOT IN ('ganado', 'perdido')
      ORDER BY l.value DESC NULLS LAST, l.updated_at DESC
      LIMIT 6
    `,
    query`
      SELECT
        i.id, i.number, i.amount, i.currency, i.status, i.due_date,
        c.company AS client_company
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE i.status IN ('enviada', 'vencida')
      ORDER BY
        CASE i.status WHEN 'vencida' THEN 0 ELSE 1 END,
        i.due_date ASC NULLS LAST
      LIMIT 6
    `,
    query`
      SELECT
        p.id, p.name, p.status, p.budget, p.progress_percent, p.end_date,
        c.company AS client_company
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.status = 'activo'
      ORDER BY p.progress_percent DESC, p.updated_at DESC
      LIMIT 5
    `,
    query`
      SELECT
        l.id, l.name, l.stage, l.value, l.updated_at,
        c.company AS client_company
      FROM leads l
      LEFT JOIN clients c ON c.id = l.client_id
      ORDER BY l.updated_at DESC
      LIMIT 8
    `,
  ]);

  const latest = snapshots[0] ?? null;
  const prev = snapshots[1] ?? null;
  const mrrDelta =
    latest && prev && Number(prev.mrr) > 0
      ? ((Number(latest.mrr) - Number(prev.mrr)) / Number(prev.mrr)) * 100
      : 0;

  const openPipeline = pipeline
    .filter((r) => !["ganado", "perdido"].includes(r.stage))
    .reduce((sum, r) => sum + Number(r.total_value || 0), 0);

  const openDealsCount = pipeline
    .filter((r) => !["ganado", "perdido"].includes(r.stage))
    .reduce((sum, r) => sum + Number(r.count || 0), 0);

  return {
    mrr: latest ? Number(latest.mrr) : 0,
    mrrDelta,
    newMrr: latest ? Number(latest.new_mrr) : 0,
    churnedMrr: latest ? Number(latest.churned_mrr) : 0,
    activeClients: activeClients[0]?.count ?? 0,
    activeProjects: activeProjectsCount[0]?.count ?? 0,
    openInvoices: openInvoices[0]?.open_amount ?? 0,
    openInvoicesCount: openInvoices[0]?.open_count ?? 0,
    openPipeline,
    openDealsCount,
    pipeline,
    snapshots: snapshots.slice().reverse(),
    topDeals,
    invoicesAtRisk,
    projectsActive: activeProjects,
    recentLeads,
  };
}
