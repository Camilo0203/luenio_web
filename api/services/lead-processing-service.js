import { assertLeadLimit, getLeadUsage } from "../../config/billing.js";
import { buildLeadMetadataUpdatedEvent, buildPipelineUpdatedEvent } from "../../core/events.js";
import {
  appendContactLog,
  isValidPipelineStage,
  normalizeContactLog,
  normalizeContactLogEntry,
  normalizeLead,
  normalizeNextAction,
  normalizeNotes,
  normalizeOptionalIsoDate,
  normalizeTags,
  validateLead,
} from "../../core/engine.js";
import {
  assertNoRecentLeadDuplicate,
  listCrmData,
  listWorkspaceMembers,
  storeCrmRecord,
  updateLeadPipeline,
} from "../../db/storage.js";
import { runAutomationEngine } from "./automation-service.js";
import { buildCrmRecordBundle } from "./crm-record-service.js";

export class LeadValidationError extends Error {
  constructor(missingFields) {
    super("Missing required fields");
    this.name = "LeadValidationError";
    this.statusCode = 400;
    this.missingFields = missingFields;
  }
}

export class PipelineStageValidationError extends Error {
  constructor(message = "Invalid pipeline stage.") {
    super(message);
    this.name = "PipelineStageValidationError";
    this.statusCode = 400;
  }
}

function assertValidLead(lead) {
  const missingFields = validateLead(lead);
  if (missingFields.length) throw new LeadValidationError(missingFields);
}

function normalizeLeadInput(body = {}) {
  const lead = normalizeLead(body);
  assertValidLead(lead);
  return lead;
}

function buildLeadCaptureResponse({ lead, actionLog, stored, usage, user }) {
  return {
    ok: true,
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    classification: lead.classification,
    workflow: actionLog.workflow,
    actions: actionLog.actions,
    restrictedActions: actionLog.restrictedActions || [],
    integrations: actionLog.integrationResults,
    internalActions: actionLog.internalActionResults,
    scoreReasons: lead.scoreReasons,
    storedLeads: stored.storedLeads,
    usage,
    userId: user.id,
  };
}

function buildLeadProcessResponse({ lead, actionLog, stored, usage }) {
  return {
    ok: true,
    mode: "processed",
    lead,
    action: actionLog,
    usage,
    storedLeads: stored.storedLeads,
  };
}

function buildLeadStoredLog({ lead, actionLog }) {
  return {
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    classification: lead.classification,
    workflow: actionLog.workflow,
  };
}

function isLeadUpdateRequest(body = {}) {
  return Boolean(
    body.leadId &&
    (body.status ||
      body.notes !== undefined ||
      body.tags !== undefined ||
      body.nextAction !== undefined ||
      body.nextActionAt !== undefined ||
      body.assigneeUserId !== undefined ||
      body.logContact ||
      body.contactLogEntry),
  );
}

function readExistingOpsFields(lead = {}) {
  return {
    contactLog: normalizeContactLog(lead.contactLog ?? lead.contact_log ?? []),
    nextAction: lead.nextAction ?? lead.next_action ?? "",
    nextActionAt: lead.nextActionAt ?? lead.next_action_at ?? null,
    lastContactedAt: lead.lastContactedAt ?? lead.last_contacted_at ?? null,
  };
}

function normalizeLeadUpdates(body = {}, existingLead = {}) {
  const updates = {};
  const existing = readExistingOpsFields(existingLead);

  if (body.status || body.pipelineStage) {
    if (
      !isValidPipelineStage(body.status || body.pipelineStage) ||
      (body.pipelineStage && !isValidPipelineStage(body.pipelineStage))
    ) {
      throw new PipelineStageValidationError();
    }
    updates.status = body.status || body.pipelineStage;
    updates.pipelineStage = body.pipelineStage || body.status;
  }

  if (body.notes !== undefined) {
    updates.notes = normalizeNotes(body.notes);
  }

  if (body.tags !== undefined) {
    updates.tags = normalizeTags(body.tags);
  }

  if (body.nextAction !== undefined) {
    updates.nextAction = normalizeNextAction(body.nextAction);
  }

  if (body.nextActionAt !== undefined) {
    updates.nextActionAt = normalizeOptionalIsoDate(body.nextActionAt);
  }

  if (body.assigneeUserId !== undefined) {
    const assignee = body.assigneeUserId;
    if (assignee === null || assignee === "") {
      updates.assigneeUserId = null;
    } else {
      updates.assigneeUserId = String(assignee).trim().slice(0, 180) || null;
    }
  }

  const rawContact = body.logContact || body.contactLogEntry;
  if (rawContact) {
    const entry = normalizeContactLogEntry(rawContact, {
      actorUserId: body.actorUserId || null,
    });
    if (!entry) {
      throw new PipelineStageValidationError("Contact log summary is required.");
    }
    updates.contactLog = appendContactLog(existing.contactLog, entry);
    updates.lastContactedAt = entry.createdAt;
  }

  if (!Object.keys(updates).length) {
    throw new PipelineStageValidationError("No valid lead updates provided.");
  }

  return updates;
}

function isPipelineOnlyUpdate(updates) {
  const keys = Object.keys(updates);
  return (
    updates.status !== undefined && keys.every((key) => key === "status" || key === "pipelineStage")
  );
}

export async function processCrmLead({ lead, user }) {
  const tenantId = user.businessId || user.id;
  const currentData = await listCrmData(tenantId);
  assertNoRecentLeadDuplicate(currentData.leads, lead.phone);
  assertLeadLimit(user, currentData.leads);

  const actionLog = await runAutomationEngine(lead, { plan: user.plan });
  const crmRecord = buildCrmRecordBundle({ lead, actionLog, userId: tenantId });
  const stored = await storeCrmRecord(crmRecord);
  const usage = getLeadUsage(user, [lead, ...(currentData.leads || [])]);

  return {
    actionLog,
    stored,
    usage,
  };
}

function leadMatchesQuery(lead, query) {
  if (!query) return true;
  const tags = Array.isArray(lead.tags) ? lead.tags : [];
  const haystack = [
    lead.name,
    lead.business,
    lead.phone,
    lead.service,
    lead.message,
    lead.source,
    lead.notes,
    lead.nextAction || lead.next_action,
    ...tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export async function listCrmWorkspace(user, { q = "", limit = 200, cursor = "" } = {}) {
  const tenantId = user.businessId || user.id;
  const data = await listCrmData(tenantId);
  const members = await listWorkspaceMembers(tenantId);
  const { storage: _storage, ...workspace } = data;
  const query = String(q || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);

  let leads = Array.isArray(workspace.leads) ? [...workspace.leads] : [];
  if (query) {
    leads = leads.filter((lead) => leadMatchesQuery(lead, query));
  }

  // Stable order: newest first when timestamps exist
  leads.sort((a, b) => {
    const ta = new Date(a.created_at || a.timestamp || 0).getTime();
    const tb = new Date(b.created_at || b.timestamp || 0).getTime();
    return tb - ta;
  });

  let start = 0;
  if (cursor) {
    const index = leads.findIndex((lead) => lead.id === cursor);
    start = index >= 0 ? index + 1 : 0;
  }
  const page = leads.slice(start, start + safeLimit);
  const nextCursor = start + safeLimit < leads.length ? page[page.length - 1]?.id || null : null;

  // Ensure current user appears in the assignee list even on sparse local DB.
  const memberMap = new Map(members.map((member) => [member.id, member]));
  if (user?.id && !memberMap.has(user.id)) {
    memberMap.set(user.id, {
      id: user.id,
      email: user.email || "",
      role: user.role || "client",
      businessName: user.businessName || "",
    });
  }

  return {
    ok: true,
    ...workspace,
    leads: page,
    members: [...memberMap.values()],
    pagination: {
      total: leads.length,
      limit: safeLimit,
      cursor: cursor || null,
      nextCursor,
      q: query || null,
    },
  };
}

export async function captureCrmLeadFromBody({ body = {}, user }) {
  const lead = normalizeLeadInput(body);
  const processed = await processCrmLead({ lead, user });

  return {
    ...processed,
    lead,
    log: buildLeadStoredLog({ lead, actionLog: processed.actionLog }),
    response: buildLeadCaptureResponse({ lead, ...processed, user }),
  };
}

export async function bulkUpdateLeads({ body = {}, user }) {
  const tenantId = user.businessId || user.id;
  const leadIds = Array.isArray(body.leadIds)
    ? [...new Set(body.leadIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 50)
    : [];
  if (!leadIds.length) {
    throw new PipelineStageValidationError("leadIds is required for bulk update.");
  }

  const currentData = await listCrmData(tenantId);
  const byId = new Map((currentData.leads || []).map((lead) => [lead.id, lead]));
  const addTags = body.addTags !== undefined ? normalizeTags(body.addTags) : null;
  const results = [];

  for (const leadId of leadIds) {
    const existing = byId.get(leadId);
    if (!existing) {
      results.push({ leadId, ok: false, error: "not_found" });
      continue;
    }

    const patch = { leadId, actorUserId: user.id };
    if (body.status || body.pipelineStage) {
      patch.status = body.status || body.pipelineStage;
      patch.pipelineStage = body.pipelineStage || body.status;
    }
    if (addTags) {
      const currentTags = normalizeTags(existing.tags || existing.Tags || []);
      patch.tags = normalizeTags([...currentTags, ...addTags]);
    }
    if (body.assigneeUserId !== undefined) {
      patch.assigneeUserId = body.assigneeUserId;
    }

    if (!patch.status && patch.tags === undefined && patch.assigneeUserId === undefined) {
      results.push({ leadId, ok: false, error: "no_updates" });
      continue;
    }

    try {
      const updates = normalizeLeadUpdates(patch, existing);
      const pipelineOnly = isPipelineOnlyUpdate(updates);
      const domainEvent = pipelineOnly
        ? buildPipelineUpdatedEvent({ userId: tenantId, leadId, updates })
        : buildLeadMetadataUpdatedEvent({ userId: tenantId, leadId, updates });
      await updateLeadPipeline(leadId, updates, tenantId, {
        ...domainEvent,
        userId: tenantId,
      });
      results.push({ leadId, ok: true });
    } catch {
      results.push({ leadId, ok: false, error: "update_failed" });
    }
  }

  const updated = results.filter((row) => row.ok).length;
  return {
    response: {
      ok: true,
      mode: "bulk_update",
      updated,
      failed: results.length - updated,
      results,
    },
  };
}

export async function importCrmLeadsFromRows({ body = {}, user }) {
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 100) : [];
  if (!rows.length) {
    throw new PipelineStageValidationError("rows is required for import.");
  }

  const results = [];
  let imported = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    try {
      const result = await captureCrmLeadFromBody({
        body: {
          name: row.name,
          business: row.business,
          phone: row.phone,
          service: row.service,
          message: row.message || "",
          source: row.source || "import_csv",
          tags: row.tags,
        },
        user,
      });
      imported += 1;
      results.push({ index, ok: true, leadId: result.lead?.id });
    } catch (error) {
      results.push({
        index,
        ok: false,
        error: error?.name === "LeadValidationError" ? "validation" : "import_failed",
        missingFields: error?.missingFields || undefined,
      });
    }
  }

  return {
    response: {
      ok: true,
      mode: "import",
      imported,
      failed: results.length - imported,
      results,
    },
  };
}

export async function processCrmRequestBody({ body = {}, user }) {
  if (body.mode === "digest") {
    const { buildDailyDigest } = await import("./digest-service.js");
    const tenantId = user.businessId || user.id;
    const data = await listCrmData(tenantId);
    const digest = buildDailyDigest(data.leads || [], { now: new Date() });
    return { response: { ok: true, mode: "digest", digest } };
  }

  if (body.mode === "bulk") {
    return bulkUpdateLeads({ body, user });
  }

  if (body.mode === "import") {
    return importCrmLeadsFromRows({ body, user });
  }

  if (isLeadUpdateRequest(body)) {
    const tenantId = user.businessId || user.id;
    const currentData = await listCrmData(tenantId);
    const existingLead = (currentData.leads || []).find((lead) => lead.id === body.leadId);
    if (!existingLead) {
      const error = new Error("Lead not found in this workspace.");
      error.statusCode = 404;
      throw error;
    }

    const updates = normalizeLeadUpdates({ ...body, actorUserId: user.id }, existingLead);
    const pipelineOnly = isPipelineOnlyUpdate(updates);
    const domainEvent = pipelineOnly
      ? buildPipelineUpdatedEvent({
          userId: tenantId,
          leadId: body.leadId,
          updates,
        })
      : buildLeadMetadataUpdatedEvent({
          userId: tenantId,
          leadId: body.leadId,
          updates,
        });
    const result = await updateLeadPipeline(body.leadId, updates, tenantId, {
      ...domainEvent,
      userId: tenantId,
    });
    return {
      response: {
        ok: true,
        mode: pipelineOnly ? "pipeline_update" : "lead_update",
        lead: result.lead,
      },
    };
  }

  const lead = normalizeLeadInput(body.lead || body);
  const processed = await processCrmLead({ lead, user });
  return {
    ...processed,
    lead,
    response: buildLeadProcessResponse({ lead, ...processed }),
  };
}
