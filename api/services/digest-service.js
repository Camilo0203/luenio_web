/**
 * Daily digest builder + optional webhook delivery for CRM work queues.
 * Payloads include lead names already stored in the CRM (not full messages/phones).
 */

import { getDigestEnv, isDigestDeliveryConfigured } from "../../config/env.js";
import { listCrmData, listCrmWorkspaceIds } from "../../db/storage.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

const STALE_HOT_MS = 48 * 60 * 60 * 1000;

function getClassification(lead) {
  return (
    lead.classification ||
    (Number(lead.score) >= 80 ? "hot" : Number(lead.score) >= 60 ? "warm" : "cold")
  );
}

function getStatus(lead) {
  return lead.pipeline_stage || lead.pipelineStage || lead.status || "new";
}

function getNextActionAt(lead) {
  return lead.nextActionAt || lead.next_action_at || null;
}

function getLastContactedAt(lead) {
  return lead.lastContactedAt || lead.last_contacted_at || null;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameLocalDay(iso, now) {
  if (!iso) return false;
  const a = new Date(iso);
  if (!Number.isFinite(a.getTime())) return false;
  return startOfLocalDay(a).getTime() === startOfLocalDay(now).getTime();
}

function isStaleHot(lead, nowMs) {
  if (getClassification(lead) !== "hot") return false;
  if (getStatus(lead) === "converted") return false;
  const last = getLastContactedAt(lead);
  if (!last) return true;
  const t = new Date(last).getTime();
  if (!Number.isFinite(t)) return true;
  return nowMs - t >= STALE_HOT_MS;
}

/**
 * @param {Array} workspaceLeads
 * @param {{ now?: Date }} options
 */
export function buildDailyDigest(workspaceLeads = [], { now = new Date() } = {}) {
  const leads = Array.isArray(workspaceLeads) ? workspaceLeads : [];
  const nowMs = now.getTime();

  const byClass = { hot: 0, warm: 0, cold: 0 };
  const dueToday = [];
  const staleHot = [];
  const noContact = [];

  for (const lead of leads) {
    const classification = getClassification(lead);
    if (byClass[classification] !== undefined) byClass[classification] += 1;

    const nextAt = getNextActionAt(lead);
    if (isSameLocalDay(nextAt, now) || (nextAt && new Date(nextAt).getTime() <= nowMs)) {
      if (getStatus(lead) !== "converted") {
        dueToday.push({
          id: lead.id,
          name: lead.name,
          nextAction: lead.nextAction || lead.next_action || "",
          nextActionAt: nextAt,
          classification,
        });
      }
    }

    if (isStaleHot(lead, nowMs)) {
      staleHot.push({
        id: lead.id,
        name: lead.name,
        classification: "hot",
        lastContactedAt: getLastContactedAt(lead),
      });
    }

    if (!getLastContactedAt(lead) && getStatus(lead) !== "converted") {
      noContact.push({ id: lead.id, name: lead.name, classification });
    }
  }

  return {
    generatedAt: now.toISOString(),
    totals: {
      leads: leads.length,
      hot: byClass.hot,
      warm: byClass.warm,
      cold: byClass.cold,
      dueToday: dueToday.length,
      staleHot: staleHot.length,
      noContact: noContact.length,
    },
    dueToday: dueToday.slice(0, 20),
    staleHot: staleHot.slice(0, 20),
    noContact: noContact.slice(0, 20),
  };
}

export function isDigestActionable(digest) {
  const totals = digest?.totals || {};
  return Number(totals.dueToday || 0) > 0 || Number(totals.staleHot || 0) > 0;
}

export function shouldSendDigest(
  digest,
  { config = getDigestEnv(), lastSentAt = 0, now = Date.now() } = {},
) {
  if (config.onlyIfActionable && !isDigestActionable(digest)) return false;
  const minMs = Math.max(1, Number(config.minHoursBetweenSends) || 20) * 60 * 60 * 1000;
  if (lastSentAt && now - lastSentAt < minMs) return false;
  return true;
}

export function buildDigestWebhookPayload({ workspaceId, digest, recipient }) {
  return {
    type: "luenio.crm.daily_digest",
    workspaceId,
    recipient: recipient || null,
    digest,
    summary: {
      dueToday: digest.totals?.dueToday || 0,
      staleHot: digest.totals?.staleHot || 0,
      noContact: digest.totals?.noContact || 0,
      leads: digest.totals?.leads || 0,
    },
  };
}

/**
 * Deliver digests for all workspaces that need attention.
 * @param {{ lastSentAtByWorkspace?: Map<string, number>, now?: Date }} options
 */
export async function deliverWorkspaceDigests({
  lastSentAtByWorkspace = new Map(),
  now = new Date(),
} = {}) {
  const config = getDigestEnv();
  if (!isDigestDeliveryConfigured(config)) {
    return { sent: 0, skipped: 0, workspaceCount: 0, results: [] };
  }

  const url = getSecureOutboundUrl(config.webhookUrl, "DIGEST_WEBHOOK_URL");
  const workspaceIds = await listCrmWorkspaceIds();
  const nowMs = now.getTime();
  const results = [];
  let sent = 0;
  let skipped = 0;

  for (const workspaceId of workspaceIds) {
    const crm = await listCrmData(workspaceId);
    const digest = buildDailyDigest(crm.leads || [], { now });
    const lastSentAt = lastSentAtByWorkspace.get(workspaceId) || 0;

    if (!shouldSendDigest(digest, { config, lastSentAt, now: nowMs })) {
      skipped += 1;
      results.push({ workspaceId, status: "skipped" });
      continue;
    }

    const body = buildDigestWebhookPayload({
      workspaceId,
      digest,
      recipient: config.recipient || null,
    });

    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.webhookToken}`,
          },
          body: JSON.stringify(body),
        },
        10_000,
      );

      if (!response.ok) {
        skipped += 1;
        results.push({ workspaceId, status: "http_error", httpStatus: response.status });
        continue;
      }

      lastSentAtByWorkspace.set(workspaceId, nowMs);
      sent += 1;
      results.push({ workspaceId, status: "sent" });
    } catch {
      skipped += 1;
      results.push({ workspaceId, status: "network_error" });
    }
  }

  return { sent, skipped, workspaceCount: workspaceIds.length, results };
}
