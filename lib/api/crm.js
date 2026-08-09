/**
 * Server-side CRM API handlers.
 * Wire these into the existing Express/router stack.
 * All responses come from Neon queries — never mock arrays.
 */

import {
  dashboardMetrics,
  listClients,
  countClients,
  listLeadsByStage,
  updateLeadStage,
  getLeadById,
  listProjects,
  listInvoices,
  listUsers,
  invoiceTotalsByStatus,
  pipelineSummary,
} from "../db/queries.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseUrl(req) {
  try {
    return new URL(req.url, "http://localhost");
  } catch {
    return new URL("/", "http://localhost");
  }
}

/**
 * Route dispatcher for /api/crm/*
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleCrmApi(req, res) {
  const url = parseUrl(req);
  const path = url.pathname.replace(/^\/api\/crm/, "") || "/";

  try {
    if (req.method === "GET" && path === "/health") {
      const { pingDb } = await import("../db/client.js");
      const ok = await pingDb();
      return json(res, ok ? 200 : 503, { ok });
    }

    if (req.method === "GET" && path === "/dashboard") {
      const data = await dashboardMetrics();
      return json(res, 200, { data });
    }

    if (req.method === "GET" && path === "/clients") {
      const status = url.searchParams.get("status") || null;
      const search = url.searchParams.get("q") || null;
      const page = Math.max(0, Number(url.searchParams.get("page") || 0));
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 25)));
      const offset = page * limit;
      const [rows, total] = await Promise.all([
        listClients({ status, search, limit, offset }),
        countClients({ status, search }),
      ]);
      return json(res, 200, { data: rows, total, page, limit });
    }

    if (req.method === "GET" && path === "/pipeline") {
      const board = await listLeadsByStage();
      const summary = await pipelineSummary();
      return json(res, 200, { data: board, summary });
    }

    if (req.method === "GET" && path.startsWith("/leads/")) {
      const id = path.split("/")[2];
      const lead = await getLeadById(id);
      if (!lead) return json(res, 404, { error: "Lead not found" });
      return json(res, 200, { data: lead });
    }

    if (req.method === "PATCH" && path.startsWith("/leads/") && path.endsWith("/stage")) {
      const id = path.split("/")[2];
      const body = await readBody(req);
      const stage = body?.stage;
      const position = Number(body?.position ?? 0);
      if (!stage) return json(res, 400, { error: "stage required" });
      const updated = await updateLeadStage({ id, stage, position });
      if (!updated) return json(res, 404, { error: "Lead not found" });
      return json(res, 200, { data: updated });
    }

    if (req.method === "GET" && path === "/projects") {
      const status = url.searchParams.get("status") || null;
      const data = await listProjects({ status });
      return json(res, 200, { data });
    }

    if (req.method === "GET" && path === "/invoices") {
      const status = url.searchParams.get("status") || null;
      const page = Math.max(0, Number(url.searchParams.get("page") || 0));
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 25)));
      const data = await listInvoices({ status, limit, offset: page * limit });
      const totals = await invoiceTotalsByStatus();
      return json(res, 200, { data, totals, page, limit });
    }

    if (req.method === "GET" && path === "/users") {
      const data = await listUsers();
      return json(res, 200, { data });
    }

    return json(res, 404, { error: "Not found", path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return json(res, status, { error: message });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
