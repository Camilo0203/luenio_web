/**
 * CRM Agency API — Neon-backed endpoints under /api/crm/*
 * Auth: required in production unless CRM_PUBLIC=true.
 */

import {
  dashboardMetrics,
  listClients,
  countClients,
  listLeadsByStage,
  updateLeadStage,
  getLeadById,
  createLead,
  listProjects,
  listInvoices,
  listUsers,
  invoiceTotalsByStatus,
  pipelineSummary,
} from "../lib/db/queries.js";
import { pingDb } from "../lib/db/client.js";
import { captureException } from "../lib/sentry.js";
import { getSessionUser } from "./services/auth-service.js";
import { getCrmEnv, getSentryEnv, isProduction } from "../config/env.js";

function crmApiIsPublic() {
  if (getCrmEnv().public) return true;
  // Local development: open API for QA without session
  if (!isProduction()) return true;
  return false;
}

function debugEndpointsEnabled() {
  return getCrmEnv().debugEndpoints;
}

async function requireCrmAuth(request, response) {
  if (crmApiIsPublic()) return { ok: true, user: null };
  const user = await getSessionUser(request);
  if (!user) {
    response.status(401).json({ error: "Authentication required." });
    return { ok: false, user: null };
  }
  return { ok: true, user };
}

function publicErrorMessage(err) {
  if (!isProduction()) {
    return err instanceof Error ? err.message : "Unknown error";
  }
  const msg = err instanceof Error ? err.message : "";
  if (/DATABASE_URL|NEON_DATABASE_URL/i.test(msg)) {
    return "Database unavailable.";
  }
  if (err?.statusCode === 400) return msg || "Bad request.";
  return "Internal server error.";
}

export default async function crmHandler(request, response) {
  const method = request.method || "GET";
  const pathname = String(request.pathname || "");
  const sub = pathname.replace(/^\/api\/crm\/?/, "") || "";
  const query = request.query || {};

  try {
    // Health stays open so deploy probes work without cookies
    if (method === "GET" && sub === "health") {
      const ok = await pingDb();
      return response.status(ok ? 200 : 503).json({ ok });
    }

    if (method === "GET" && sub === "debug/error") {
      if (!debugEndpointsEnabled()) {
        return response.status(404).json({ error: "Not found" });
      }
      const err = new Error("CRM controlled failure for Sentry verification");
      err.name = "CrmSentryProbeError";
      captureException(err, { path: sub, intentional: true });
      return response.status(500).json({
        error: err.message,
        sentry: getSentryEnv().configured,
      });
    }

    // Session email for CRM chrome (optional in public/dev mode)
    if (method === "GET" && sub === "me") {
      const user = await getSessionUser(request);
      if (!user) {
        if (crmApiIsPublic()) {
          return response.status(200).json({
            data: { email: null, name: null, publicMode: true },
          });
        }
        return response.status(401).json({ error: "Authentication required." });
      }
      return response.status(200).json({
        data: {
          email: user.email || null,
          name: user.businessName || user.business_name || user.name || null,
          role: user.role || null,
          publicMode: false,
        },
      });
    }

    const auth = await requireCrmAuth(request, response);
    if (!auth.ok) return;

    if (method === "GET" && sub === "dashboard") {
      const data = await dashboardMetrics();
      return response.status(200).json({ data });
    }

    if (method === "GET" && sub === "clients") {
      const status = query.status || null;
      const search = query.q || null;
      const page = Math.max(0, Number(query.page || 0));
      const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
      const offset = page * limit;
      const [rows, total] = await Promise.all([
        listClients({ status, search, limit, offset }),
        countClients({ status, search }),
      ]);
      return response.status(200).json({ data: rows, total, page, limit });
    }

    if (method === "GET" && sub === "pipeline") {
      const board = await listLeadsByStage();
      const summary = await pipelineSummary();
      return response.status(200).json({ data: board, summary });
    }

    if (method === "POST" && sub === "leads") {
      const body = request.body || {};
      const lead = await createLead({
        name: body.name,
        stage: body.stage,
        value: body.value,
        probability: body.probability,
        client_id: body.client_id || null,
        owner_id: body.owner_id || null,
        notes: body.notes || "",
      });
      return response.status(201).json({ data: lead });
    }

    if (method === "GET" && sub.startsWith("leads/")) {
      const id = sub.split("/")[1];
      const lead = await getLeadById(id);
      if (!lead) return response.status(404).json({ error: "Lead not found" });
      return response.status(200).json({ data: lead });
    }

    if (method === "PATCH" && /^leads\/[^/]+\/stage$/.test(sub)) {
      const id = sub.split("/")[1];
      const stage = request.body?.stage;
      const position = Number(request.body?.position ?? 0);
      if (!stage) return response.status(400).json({ error: "stage required" });
      const updated = await updateLeadStage({ id, stage, position });
      if (!updated) return response.status(404).json({ error: "Lead not found" });
      return response.status(200).json({ data: updated });
    }

    if (method === "GET" && sub === "projects") {
      const status = query.status || null;
      const data = await listProjects({ status });
      return response.status(200).json({ data });
    }

    if (method === "GET" && sub === "invoices") {
      const status = query.status || null;
      const page = Math.max(0, Number(query.page || 0));
      const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
      const data = await listInvoices({ status, limit, offset: page * limit });
      const totals = await invoiceTotalsByStatus();
      return response.status(200).json({ data, totals, page, limit });
    }

    if (method === "GET" && sub === "users") {
      const data = await listUsers();
      return response.status(200).json({ data });
    }

    response.setHeader?.("Allow", "GET, POST, PATCH");
    return response.status(404).json({ error: "Not found", path: sub });
  } catch (err) {
    captureException(err, { path: sub, method });
    const status =
      err?.statusCode || (/DATABASE_URL|NEON_DATABASE_URL/i.test(err?.message || "") ? 503 : 500);
    return response.status(status).json({ error: publicErrorMessage(err) });
  }
}
