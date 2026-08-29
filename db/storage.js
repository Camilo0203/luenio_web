import fs from "node:fs";
import path from "node:path";
import { getLocalStorageEnv, getSupabaseEnv, isProduction } from "../config/env.js";

const defaultDbPath = path.join(process.cwd(), "db", "leads-db.json");
const { fixturePath: fixtureDbPath, fixtureAllowed } = getLocalStorageEnv();
if (fixtureDbPath && !fixtureAllowed) {
  throw new Error("LUENIO_LOCAL_DB_PATH is restricted to NODE_ENV=test.");
}
const dbPath = fixtureDbPath ? path.resolve(fixtureDbPath) : defaultDbPath;
const DUPLICATE_WINDOW_MS = 90_000;

export function getSupabaseConfig() {
  const { url, key } = getSupabaseEnv();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

function requiresSupabase() {
  return getSupabaseEnv().required;
}

function assertStorageAvailable() {
  if (requiresSupabase() && !getSupabaseConfig()) {
    throw new Error(
      "Supabase is required but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }
}

export async function supabaseRequest(pathname, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
      ...options,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = (await response.text()).slice(0, 4_000);
      const databaseCode = [
        "INVITATION_INVALID",
        "INVITATION_UNAVAILABLE",
        "INVITATION_EXPIRED",
        "INVITATION_USER_EXISTS",
        "RESET_INVALID",
        "RESET_UNAVAILABLE",
        "RESET_EXPIRED",
        "CONTACT_DUPLICATE",
        "CONTACT_DELIVERY_INVALID",
        "INVALID_THROTTLE_KEY",
      ].find((code) => responseBody.includes(code));
      if (!isProduction()) {
        console.error("[Luenio DB] Supabase error", {
          pathname,
          status: response.status,
          body: responseBody.slice(0, 500),
        });
      }
      const error = new Error(`Supabase request failed (${response.status}).`);
      error.statusCode = 503;
      error.publicMessage =
        "No pudimos conectar con el servicio de datos. Intenta de nuevo en un momento.";
      error.databaseCode = databaseCode || null;
      error.details = responseBody;
      throw error;
    }

    return response.json().catch(() => []);
  } catch (error) {
    if (error.statusCode) throw error;
    if (!isProduction()) {
      console.error("[Luenio DB] Supabase network/error", pathname, error?.message || error);
    }
    const storageError = new Error("Supabase request failed.");
    storageError.statusCode = 503;
    storageError.publicMessage =
      "No pudimos conectar con el servicio de datos. Intenta de nuevo en un momento.";
    storageError.cause = error;
    throw storageError;
  } finally {
    clearTimeout(timeoutId);
  }
}

function emptyDatabase() {
  return {
    users: [],
    leads: [],
    events: [],
    actions: [],
    notifications: [],
    subscriptions: [],
    inquiries: [],
    contactDeliveries: [],
    businesses: [],
    memberships: [],
    invitations: [],
    auditLogs: [],
    passwordResets: [],
    sessions: [],
    authThrottles: [],
    authChallenges: [],
    updatedAt: null,
  };
}

function readLocalDatabase() {
  try {
    if (!fs.existsSync(dbPath)) return emptyDatabase();
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (error) {
    console.warn("[Luenio DB] Could not read local JSON DB", error);
    return emptyDatabase();
  }
}

export function readLocalState() {
  assertStorageAvailable();
  return readLocalDatabase();
}

export function writeLocalState(database) {
  assertStorageAvailable();
  return writeLocalDatabase(database);
}

function writeLocalDatabase(database) {
  const nextDatabase = { ...database, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(nextDatabase, null, 2));
  return nextDatabase;
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isRecentDuplicateByPhone(
  records = [],
  phone,
  now = new Date(),
  windowMs = DUPLICATE_WINDOW_MS,
) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;
  const nowTime = now.getTime();

  return records.some((record) => {
    const recordPhone =
      record.phoneNormalized || record.phone_normalized || normalizePhone(record.phone);
    const timestamp =
      record.created_at ||
      record.createdAt ||
      record.timestamp ||
      record.updated_at ||
      record.updatedAt;
    const time = timestamp ? new Date(timestamp).getTime() : 0;
    return (
      recordPhone === normalizedPhone &&
      Number.isFinite(time) &&
      nowTime - time >= 0 &&
      nowTime - time <= windowMs
    );
  });
}

function duplicateError() {
  const error = new Error("Duplicate request received recently.");
  error.statusCode = 409;
  return error;
}

function mapLeadForSupabase(lead) {
  return {
    id: lead.id,
    user_id: lead.actorUserId || null,
    business_id: lead.userId,
    name: lead.name,
    business: lead.business,
    phone: lead.phone,
    phone_normalized: normalizePhone(lead.phone),
    service: lead.service,
    message: lead.message,
    source: lead.source,
    notes: lead.notes ?? "",
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    next_action: lead.nextAction ?? lead.next_action ?? "",
    next_action_at: lead.nextActionAt ?? lead.next_action_at ?? null,
    last_contacted_at: lead.lastContactedAt ?? lead.last_contacted_at ?? null,
    contact_log: Array.isArray(lead.contactLog)
      ? lead.contactLog
      : Array.isArray(lead.contact_log)
        ? lead.contact_log
        : [],
    assignee_user_id: lead.assigneeUserId ?? lead.assignee_user_id ?? null,
    score: lead.score,
    classification: lead.classification,
    status: lead.status,
    pipeline_stage: lead.pipelineStage,
    score_reasons: lead.scoreReasons,
    workflow: lead.workflow || null,
    created_at: lead.timestamp,
    updated_at: lead.updatedAt,
  };
}

function mapActionForSupabase(action) {
  return {
    id: action.id,
    user_id: action.actorUserId || null,
    business_id: action.userId,
    lead_id: action.leadId,
    workflow: action.workflow,
    segment: action.segment,
    actions: action.actions,
    score: action.score,
    classification: action.classification,
    pipeline_stage: action.pipelineStage,
    score_reasons: action.scoreReasons,
    restricted_actions: action.restrictedActions || [],
    integration_results: action.integrationResults,
    internal_action_results: action.internalActionResults,
    created_at: action.timestamp,
  };
}

function mapNotificationForSupabase(notification) {
  return {
    id: notification.id,
    user_id: notification.actorUserId || null,
    business_id: notification.userId,
    lead_id: notification.leadId,
    workflow: notification.workflow,
    classification: notification.classification,
    summary: notification.summary,
    created_at: notification.timestamp,
  };
}

function mapEventForSupabase(event) {
  return {
    id: event.id,
    user_id: event.actorUserId || null,
    business_id: event.userId,
    lead_id: event.leadId || null,
    type: event.type,
    payload: event.payload || {},
    created_at: event.timestamp,
  };
}

export function getStorageMode() {
  if (requiresSupabase() && !getSupabaseConfig()) return "supabase_required_missing";
  return getSupabaseConfig() ? "supabase" : "json_fallback";
}

export function getStorageHealth() {
  const config = getSupabaseConfig();
  return {
    mode: getStorageMode(),
    supabaseConfigured: Boolean(config),
    supabaseRequired: requiresSupabase(),
    missing: {
      SUPABASE_URL: !getSupabaseEnv().url,
      SUPABASE_SERVICE_ROLE_KEY: !getSupabaseEnv().key,
    },
  };
}

export async function testStorageConnection() {
  assertStorageAvailable();

  if (getSupabaseConfig()) {
    await supabaseRequest("leads?select=id&limit=1");
    return { ok: true, storage: "supabase" };
  }

  readLocalDatabase();
  return { ok: true, storage: "json_fallback" };
}

/**
 * Workspace ids that may need a CRM digest (businesses or distinct lead tenants).
 */
/**
 * Members of a workspace for assignee pickers.
 * @returns {Promise<Array<{ id: string, email: string, role: string, businessName: string }>>}
 */
export async function listWorkspaceMembers(businessId) {
  assertStorageAvailable();
  if (!businessId) return [];

  if (getSupabaseConfig()) {
    const [byBusiness, memberships] = await Promise.all([
      supabaseRequest(
        `users?business_id=eq.${encodeURIComponent(businessId)}&select=id,email,business_name,role`,
      ),
      supabaseRequest(
        `memberships?business_id=eq.${encodeURIComponent(businessId)}&select=user_id,role`,
      ),
    ]);
    const memberIds = [
      ...new Set((memberships || []).map((row) => row.user_id || row.userId).filter(Boolean)),
    ];
    let byMembership = [];
    if (memberIds.length) {
      const filter = memberIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
      byMembership = await supabaseRequest(
        `users?id=in.(${filter})&select=id,email,business_name,role`,
      );
    }
    const byId = new Map();
    for (const user of [...(byBusiness || []), ...(byMembership || [])]) {
      if (!user?.id) continue;
      byId.set(user.id, {
        id: user.id,
        email: user.email || "",
        role: user.role || "client",
        businessName: user.business_name || user.businessName || "",
      });
    }
    return [...byId.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  const database = readLocalDatabase();
  const members = new Map();
  for (const user of database.users || []) {
    const userBusiness = user.businessId || user.business_id || user.id;
    if (userBusiness !== businessId && user.id !== businessId) continue;
    members.set(user.id, {
      id: user.id,
      email: user.email || "",
      role: user.role || "client",
      businessName: user.businessName || user.business_name || "",
    });
  }
  for (const membership of database.memberships || []) {
    const mid = membership.businessId || membership.business_id;
    if (mid !== businessId) continue;
    const uid = membership.userId || membership.user_id;
    if (!uid || members.has(uid)) continue;
    const user = (database.users || []).find((row) => row.id === uid);
    if (!user) continue;
    members.set(uid, {
      id: user.id,
      email: user.email || "",
      role: membership.role || user.role || "client",
      businessName: user.businessName || user.business_name || "",
    });
  }
  return [...members.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function listCrmWorkspaceIds() {
  assertStorageAvailable();

  if (getSupabaseConfig()) {
    try {
      const businesses = await supabaseRequest("businesses?select=id");
      const ids = (businesses || []).map((row) => row.id).filter(Boolean);
      if (ids.length) return [...new Set(ids)];
    } catch {
      // Fall through to distinct business_id from leads.
    }
    const leadRows = await supabaseRequest("leads?select=business_id");
    return [
      ...new Set((leadRows || []).map((row) => row.business_id || row.businessId).filter(Boolean)),
    ];
  }

  const database = readLocalDatabase();
  const ids = new Set();
  for (const business of database.businesses || []) {
    if (business?.id) ids.add(business.id);
  }
  for (const lead of database.leads || []) {
    if (lead?.userId) ids.add(lead.userId);
    if (lead?.businessId) ids.add(lead.businessId);
  }
  for (const user of database.users || []) {
    if (user?.business_id) ids.add(user.business_id);
    if (user?.businessId) ids.add(user.businessId);
    if (user?.id && user?.role === "admin") ids.add(user.business_id || user.businessId || user.id);
  }
  return [...ids];
}

export async function listCrmData(userId) {
  assertStorageAvailable();
  if (!userId) throw new Error("userId is required to list CRM data.");

  if (getSupabaseConfig()) {
    const [leads, actions, notifications, events] = await Promise.all([
      supabaseRequest(
        `leads?business_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
      ),
      supabaseRequest(
        `lead_actions?business_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
      ),
      supabaseRequest(
        `lead_notifications?business_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
      ),
      supabaseRequest(
        `events?business_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=100`,
      ),
    ]);
    return {
      leads,
      actions,
      notifications,
      events,
      updatedAt: new Date().toISOString(),
      storage: "supabase",
    };
  }

  const database = readLocalDatabase();
  return {
    leads: (database.leads || []).filter((lead) => lead.userId === userId),
    actions: (database.actions || []).filter((action) => action.userId === userId),
    notifications: (database.notifications || []).filter(
      (notification) => notification.userId === userId,
    ),
    events: (database.events || []).filter((event) => event.userId === userId),
    updatedAt: database.updatedAt,
    storage: "json_fallback",
  };
}

export function assertNoRecentLeadDuplicate(leads = [], phone) {
  if (isRecentDuplicateByPhone(leads, phone)) throw duplicateError();
}

export async function recordEvent(event) {
  assertStorageAvailable();
  if (!event?.id) throw new Error("event id is required to persist an event.");
  if (!event?.userId) throw new Error("userId is required to persist an event.");
  if (!event?.type) throw new Error("event type is required.");
  if (!event?.timestamp) throw new Error("event timestamp is required.");

  if (getSupabaseConfig()) {
    await supabaseRequest("events", {
      method: "POST",
      body: JSON.stringify(mapEventForSupabase(event)),
    });
    return { event, storage: "supabase" };
  }

  const database = readLocalDatabase();
  writeLocalDatabase({
    ...database,
    events: [event, ...(database.events || [])].slice(0, 1000),
  });
  return { event, storage: "json_fallback" };
}

export async function storeCrmRecord(recordBundle) {
  assertStorageAvailable();
  const tenantLead = recordBundle?.lead;
  const tenantActionLog = recordBundle?.action;
  const notification = recordBundle?.notification;
  const lifecycleEvents = recordBundle?.events || [];
  const userId = tenantLead?.userId || tenantActionLog?.userId || notification?.userId;
  if (!userId) throw new Error("userId is required to store CRM data.");
  if (!tenantLead?.id) throw new Error("lead id is required to store CRM data.");
  if (!tenantActionLog?.id) throw new Error("action id is required to store CRM data.");
  if (!notification?.id) throw new Error("notification id is required to store CRM data.");

  if (getSupabaseConfig()) {
    await supabaseRequest("leads", {
      method: "POST",
      body: JSON.stringify(
        mapLeadForSupabase({
          ...tenantLead,
          phoneNormalized: normalizePhone(tenantLead.phone),
          workflow: tenantActionLog.workflow,
        }),
      ),
    });
    await supabaseRequest("lead_actions", {
      method: "POST",
      body: JSON.stringify(mapActionForSupabase(tenantActionLog)),
    });
    await supabaseRequest("lead_notifications", {
      method: "POST",
      body: JSON.stringify(mapNotificationForSupabase(notification)),
    });
    for (const lifecycleEvent of lifecycleEvents) {
      await recordEvent(lifecycleEvent);
    }

    return {
      lead: { ...tenantLead, phoneNormalized: normalizePhone(tenantLead.phone) },
      action: tenantActionLog,
      notification,
      storedLeads: null,
      storage: "supabase",
    };
  }

  const database = readLocalDatabase();
  const localLead = { ...tenantLead, phoneNormalized: normalizePhone(tenantLead.phone) };
  const nextDatabase = writeLocalDatabase({
    ...database,
    leads: [localLead, ...(database.leads || [])].slice(0, 500),
    actions: [tenantActionLog, ...(database.actions || [])].slice(0, 500),
    notifications: [notification, ...(database.notifications || [])].slice(0, 500),
    events: [...lifecycleEvents.slice().reverse(), ...(database.events || [])].slice(0, 1000),
  });

  return {
    lead: localLead,
    action: tenantActionLog,
    notification,
    storedLeads: nextDatabase.leads.filter((item) => item.userId === userId).length,
    storage: "json_fallback",
  };
}

export async function storePublicInquiry(inquiry) {
  assertStorageAvailable();
  if (!inquiry?.id) throw new Error("inquiry id is required to store public inquiry.");
  const timestamp = new Date().toISOString();
  const publicInquiry = {
    id: inquiry.id,
    name: inquiry.name,
    business: inquiry.business,
    phone: inquiry.phone,
    phoneNormalized: normalizePhone(inquiry.phone),
    email: inquiry.email || "",
    service: inquiry.service,
    message: inquiry.message || "",
    source: inquiry.source || "landing",
    createdAt: inquiry.timestamp || timestamp,
  };
  const delivery = {
    id: `delivery_${publicInquiry.id}`,
    inquiryId: publicInquiry.id,
    status: "pending",
    attempts: 0,
    nextAttemptAt: publicInquiry.createdAt,
    lockedUntil: null,
    deliveredAt: null,
    lastHttpStatus: null,
    createdAt: publicInquiry.createdAt,
    updatedAt: publicInquiry.createdAt,
  };

  if (getSupabaseConfig()) {
    try {
      await supabaseRequest("rpc/luenio_store_contact_inquiry", {
        method: "POST",
        body: JSON.stringify({
          p_id: publicInquiry.id,
          p_delivery_id: delivery.id,
          p_name: publicInquiry.name,
          p_business: publicInquiry.business,
          p_phone: publicInquiry.phone,
          p_phone_normalized: publicInquiry.phoneNormalized,
          p_email: publicInquiry.email || null,
          p_service: publicInquiry.service,
          p_message: publicInquiry.message,
          p_source: publicInquiry.source,
          p_created_at: publicInquiry.createdAt,
          p_duplicate_window_seconds: Math.floor(DUPLICATE_WINDOW_MS / 1_000),
        }),
      });
    } catch (error) {
      if (error.databaseCode === "CONTACT_DUPLICATE") throw duplicateError();
      throw error;
    }
    return { inquiry: publicInquiry, delivery, storage: "supabase" };
  }

  const database = readLocalDatabase();
  if (isRecentDuplicateByPhone(database.inquiries || [], publicInquiry.phone))
    throw duplicateError();
  const nextDatabase = writeLocalDatabase({
    ...database,
    inquiries: [publicInquiry, ...(database.inquiries || [])].slice(0, 500),
    contactDeliveries: [delivery, ...(database.contactDeliveries || [])].slice(0, 1_000),
  });

  return {
    inquiry: publicInquiry,
    delivery,
    storedInquiries: nextDatabase.inquiries.length,
    storage: "json_fallback",
  };
}

function mapContactDeliveryClaim(record) {
  return {
    deliveryId: record.delivery_id,
    inquiry: {
      id: record.inquiry_id,
      name: record.inquiry_name,
      business: record.inquiry_business,
      phone: record.inquiry_phone,
      email: record.inquiry_email || "",
      service: record.inquiry_service,
      message: record.inquiry_message || "",
      source: record.inquiry_source || "landing",
      timestamp: record.inquiry_created_at,
    },
    attempts: record.delivery_attempts,
  };
}

export async function claimContactDeliveries({ limit = 10, inquiryId = null } = {}) {
  assertStorageAvailable();
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Contact delivery limit is invalid.");
  }
  const now = new Date();
  const nowIso = now.toISOString();

  if (getSupabaseConfig()) {
    const records = await supabaseRequest("rpc/luenio_claim_contact_deliveries", {
      method: "POST",
      body: JSON.stringify({
        p_now: nowIso,
        p_limit: limit,
        p_lock_seconds: 300,
        p_inquiry_id: inquiryId || null,
      }),
    });
    return records.map(mapContactDeliveryClaim);
  }

  const database = readLocalDatabase();
  const deliveries = database.contactDeliveries || [];
  const claimedIds = deliveries
    .filter((delivery) => {
      if (delivery.attempts >= 10) return false;
      if (inquiryId && delivery.inquiryId !== inquiryId) return false;
      const due = new Date(delivery.nextAttemptAt).getTime() <= now.getTime();
      const staleLock =
        delivery.status === "processing" &&
        delivery.lockedUntil &&
        new Date(delivery.lockedUntil).getTime() <= now.getTime();
      return (["pending", "retry"].includes(delivery.status) && due) || staleLock;
    })
    .sort((left, right) => new Date(left.nextAttemptAt) - new Date(right.nextAttemptAt))
    .slice(0, limit)
    .map((delivery) => delivery.id);
  const claimedIdSet = new Set(claimedIds);
  const nextDeliveries = deliveries.map((delivery) =>
    claimedIdSet.has(delivery.id)
      ? {
          ...delivery,
          status: "processing",
          attempts: delivery.attempts + 1,
          lockedUntil: new Date(now.getTime() + 5 * 60 * 1_000).toISOString(),
          updatedAt: nowIso,
        }
      : delivery,
  );
  writeLocalDatabase({ ...database, contactDeliveries: nextDeliveries });
  const inquiries = new Map((database.inquiries || []).map((inquiry) => [inquiry.id, inquiry]));
  return nextDeliveries
    .filter((delivery) => claimedIdSet.has(delivery.id))
    .map((delivery) => ({
      deliveryId: delivery.id,
      inquiry: {
        ...inquiries.get(delivery.inquiryId),
        timestamp: inquiries.get(delivery.inquiryId)?.createdAt,
      },
      attempts: delivery.attempts,
    }))
    .filter((claim) => claim.inquiry?.id);
}

export async function completeContactDelivery({ deliveryId, succeeded, httpStatus = null }) {
  assertStorageAvailable();
  const normalizedHttpStatus =
    Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null;
  const now = new Date();
  const nowIso = now.toISOString();

  if (getSupabaseConfig()) {
    const [result] = await supabaseRequest("rpc/luenio_complete_contact_delivery", {
      method: "POST",
      body: JSON.stringify({
        p_delivery_id: deliveryId,
        p_succeeded: Boolean(succeeded),
        p_http_status: normalizedHttpStatus,
        p_now: nowIso,
      }),
    });
    return result || null;
  }

  const database = readLocalDatabase();
  let completed = null;
  const contactDeliveries = (database.contactDeliveries || []).map((delivery) => {
    if (delivery.id !== deliveryId || delivery.status !== "processing") return delivery;
    const status = succeeded ? "sent" : delivery.attempts >= 10 ? "dead" : "retry";
    const backoffSeconds = Math.min(3_600, 30 * 2 ** Math.max(delivery.attempts - 1, 0));
    completed = {
      ...delivery,
      status,
      nextAttemptAt: succeeded
        ? delivery.nextAttemptAt
        : new Date(now.getTime() + backoffSeconds * 1_000).toISOString(),
      lockedUntil: null,
      deliveredAt: succeeded ? nowIso : delivery.deliveredAt,
      lastHttpStatus: normalizedHttpStatus,
      updatedAt: nowIso,
    };
    return completed;
  });
  writeLocalDatabase({ ...database, contactDeliveries });
  return completed;
}

export async function getContactDeliveryHealth() {
  assertStorageAvailable();
  const records = getSupabaseConfig()
    ? await supabaseRequest(
        "contact_deliveries?select=status,next_attempt_at,updated_at&status=in.(pending,retry,processing,dead)&order=next_attempt_at.asc&limit=1000",
      )
    : readLocalDatabase().contactDeliveries || [];
  const active = records.filter((record) =>
    ["pending", "retry", "processing", "dead"].includes(record.status),
  );
  const counts = active.reduce(
    (summary, record) => ({ ...summary, [record.status]: (summary[record.status] || 0) + 1 }),
    { pending: 0, retry: 0, processing: 0, dead: 0 },
  );
  const oldestTimestamp = active
    .filter((record) => record.status !== "dead")
    .map(
      (record) =>
        record.nextAttemptAt || record.next_attempt_at || record.updatedAt || record.updated_at,
    )
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  const oldestAgeSeconds = oldestTimestamp
    ? Math.max(0, Math.floor((Date.now() - oldestTimestamp) / 1_000))
    : 0;
  return {
    healthy: counts.dead === 0 && oldestAgeSeconds < 15 * 60,
    pending: counts.pending,
    retry: counts.retry,
    processing: counts.processing,
    dead: counts.dead,
    oldestAgeSeconds,
  };
}

export async function updateLeadPipeline(leadId, updates, userId, pipelineEvent) {
  assertStorageAvailable();
  if (!userId) throw new Error("userId is required to update CRM data.");
  if (!pipelineEvent?.id) throw new Error("pipeline event id is required to update CRM data.");
  if (pipelineEvent.userId !== userId)
    throw new Error("pipeline event userId must match the workspace.");
  if (pipelineEvent.leadId !== leadId)
    throw new Error("pipeline event leadId must match the updated lead.");
  const notFoundError = new Error("Lead not found in this workspace.");
  notFoundError.statusCode = 404;

  if (getSupabaseConfig()) {
    const body = {
      updated_at: new Date().toISOString(),
    };
    if (updates.status !== undefined) body.status = updates.status;
    if (updates.pipelineStage !== undefined || updates.status !== undefined) {
      body.pipeline_stage = updates.pipelineStage || updates.status;
    }
    if (updates.notes !== undefined) body.notes = updates.notes;
    if (updates.tags !== undefined) body.tags = updates.tags;
    if (updates.nextAction !== undefined) body.next_action = updates.nextAction;
    if (updates.nextActionAt !== undefined) body.next_action_at = updates.nextActionAt;
    if (updates.lastContactedAt !== undefined) body.last_contacted_at = updates.lastContactedAt;
    if (updates.contactLog !== undefined) body.contact_log = updates.contactLog;
    if (updates.assigneeUserId !== undefined) body.assignee_user_id = updates.assigneeUserId;
    const [lead] = await supabaseRequest(
      `leads?id=eq.${encodeURIComponent(leadId)}&business_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    if (!lead) throw notFoundError;
    await recordEvent(pipelineEvent);
    return { lead, storage: "supabase" };
  }

  const database = readLocalDatabase();
  const existingLead = (database.leads || []).find(
    (lead) => lead.id === leadId && lead.userId === userId,
  );
  if (!existingLead) throw notFoundError;

  const nextUpdates = { ...updates };
  if (nextUpdates.pipelineStage === undefined && nextUpdates.status !== undefined) {
    nextUpdates.pipelineStage = nextUpdates.status;
  }

  const leads = (database.leads || []).map((lead) =>
    lead.id === leadId && lead.userId === userId
      ? { ...lead, ...nextUpdates, updatedAt: new Date().toISOString() }
      : lead,
  );
  writeLocalDatabase({
    ...database,
    leads,
    events: [pipelineEvent, ...(database.events || [])].slice(0, 1000),
  });
  return {
    lead: leads.find((lead) => lead.id === leadId && lead.userId === userId),
    storage: "json_fallback",
  };
}

export async function updateUserSubscription(
  subscription,
  subscriptionEvent,
  { workspaceId = subscription?.userId } = {},
) {
  assertStorageAvailable();
  const { userId, plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd } =
    subscription || {};
  if (!userId) throw new Error("userId is required to update subscription.");
  if (!subscription?.id) throw new Error("subscription id is required to update subscription.");
  if (!subscriptionEvent?.id)
    throw new Error("subscription event id is required to update subscription.");
  if (!workspaceId) throw new Error("workspaceId is required to record subscription activity.");
  if (subscriptionEvent.userId !== workspaceId)
    throw new Error("subscription event userId must match the workspace.");

  const timestamp = subscription.updatedAt || new Date().toISOString();
  const subscriptionRecord = { ...subscription, updatedAt: timestamp };

  if (getSupabaseConfig()) {
    await supabaseRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        plan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: status,
        updated_at: timestamp,
      }),
    });

    const existing = await supabaseRequest(
      `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    );
    if (existing?.[0]?.id) {
      await supabaseRequest(`subscriptions?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan,
          status,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          current_period_end: currentPeriodEnd,
          updated_at: timestamp,
        }),
      });
    } else {
      await supabaseRequest("subscriptions", {
        method: "POST",
        body: JSON.stringify({
          id: subscriptionRecord.id,
          user_id: userId,
          plan,
          status,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          current_period_end: currentPeriodEnd,
          created_at: timestamp,
          updated_at: timestamp,
        }),
      });
    }

    await recordEvent(subscriptionEvent);
    return { subscription: subscriptionRecord, storage: "supabase" };
  }

  const database = readLocalDatabase();
  const users = (database.users || []).map((user) =>
    user.id === userId
      ? {
          ...user,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          subscriptionStatus: status,
          updatedAt: timestamp,
        }
      : user,
  );
  const subscriptions = [
    subscriptionRecord,
    ...(database.subscriptions || []).filter((item) => item.userId !== userId),
  ];
  writeLocalDatabase({
    ...database,
    users,
    subscriptions,
    events: [subscriptionEvent, ...(database.events || [])].slice(0, 1000),
  });
  return { subscription: subscriptionRecord, storage: "json_fallback" };
}
