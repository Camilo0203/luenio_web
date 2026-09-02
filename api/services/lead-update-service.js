import { buildLeadMetadataUpdatedEvent, buildPipelineUpdatedEvent } from "../../core/events.js";
import {
  appendContactLog,
  isValidPipelineStage,
  normalizeContactLog,
  normalizeContactLogEntry,
  normalizeNextAction,
  normalizeNotes,
  normalizeOptionalIsoDate,
  normalizeTags,
} from "../../core/engine.js";
import { listCrmData, updateLeadPipeline } from "../../db/storage.js";
import { isPipelineOnlyUpdate, PipelineStageValidationError } from "./lead-validation-service.js";

function readExistingOpsFields(lead = {}) {
  return {
    contactLog: normalizeContactLog(lead.contactLog ?? lead.contact_log ?? []),
    nextAction: lead.nextAction ?? lead.next_action ?? "",
    nextActionAt: lead.nextActionAt ?? lead.next_action_at ?? null,
    lastContactedAt: lead.lastContactedAt ?? lead.last_contacted_at ?? null,
  };
}

export function normalizeLeadUpdates(body = {}, existingLead = {}) {
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

/**
 * Shared by the single-lead update path (processCrmRequestBody) and
 * bulkUpdateLeads below: normalize -> classify -> build the matching domain
 * event -> persist. Was duplicated inline in both call sites before this
 * extraction; behavior (including error propagation on invalid input) is
 * unchanged for both.
 */
export async function applyLeadUpdate({ leadId, tenantId, patch, existingLead }) {
  const updates = normalizeLeadUpdates(patch, existingLead);
  const pipelineOnly = isPipelineOnlyUpdate(updates);
  const domainEvent = pipelineOnly
    ? buildPipelineUpdatedEvent({ userId: tenantId, leadId, updates })
    : buildLeadMetadataUpdatedEvent({ userId: tenantId, leadId, updates });
  const result = await updateLeadPipeline(leadId, updates, tenantId, {
    ...domainEvent,
    userId: tenantId,
  });
  return { pipelineOnly, result };
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
      await applyLeadUpdate({ leadId, tenantId, patch, existingLead: existing });
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
