import fs from "node:fs";
import path from "node:path";
import { getSupabaseEnv } from "../config/env.js";

const dbPath = path.join(process.cwd(), "db", "leads-db.json");
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
    throw new Error("Supabase is required but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
}

export async function supabaseRequest(pathname, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${pathname} failed ${response.status}: ${body}`);
  }

  return response.json().catch(() => []);
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

export function isRecentDuplicateByPhone(records = [], phone, now = new Date(), windowMs = DUPLICATE_WINDOW_MS) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;
  const nowTime = now.getTime();

  return records.some((record) => {
    const recordPhone = record.phoneNormalized || record.phone_normalized || normalizePhone(record.phone);
    const timestamp = record.created_at || record.createdAt || record.timestamp || record.updated_at || record.updatedAt;
    const time = timestamp ? new Date(timestamp).getTime() : 0;
    return recordPhone === normalizedPhone && Number.isFinite(time) && nowTime - time >= 0 && nowTime - time <= windowMs;
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
    user_id: lead.userId,
    name: lead.name,
    business: lead.business,
    phone: lead.phone,
    phone_normalized: normalizePhone(lead.phone),
    service: lead.service,
    message: lead.message,
    source: lead.source,
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
    user_id: action.userId,
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
    user_id: notification.userId,
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
    user_id: event.userId,
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

export async function listCrmData(userId) {
  assertStorageAvailable();
  if (!userId) throw new Error("userId is required to list CRM data.");

  if (getSupabaseConfig()) {
    const [leads, actions, notifications, events] = await Promise.all([
      supabaseRequest(`leads?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`),
      supabaseRequest(`lead_actions?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`),
      supabaseRequest(`lead_notifications?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`),
      supabaseRequest(`events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=100`),
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
    notifications: (database.notifications || []).filter((notification) => notification.userId === userId),
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
      body: JSON.stringify(mapLeadForSupabase({ ...tenantLead, phoneNormalized: normalizePhone(tenantLead.phone), workflow: tenantActionLog.workflow })),
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
    service: inquiry.service,
    message: inquiry.message || "",
    source: inquiry.source || "landing",
    createdAt: inquiry.timestamp || timestamp,
  };

  if (getSupabaseConfig()) {
    const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const duplicate = await supabaseRequest(
      `contact_inquiries?phone_normalized=eq.${encodeURIComponent(publicInquiry.phoneNormalized)}&created_at=gte.${encodeURIComponent(cutoff)}&select=id&limit=1`
    );
    if (duplicate?.length) throw duplicateError();

    await supabaseRequest("contact_inquiries", {
      method: "POST",
      body: JSON.stringify({
        id: publicInquiry.id,
        name: publicInquiry.name,
        business: publicInquiry.business,
        phone: publicInquiry.phone,
        phone_normalized: publicInquiry.phoneNormalized,
        service: publicInquiry.service,
        message: publicInquiry.message,
        source: publicInquiry.source,
        created_at: publicInquiry.createdAt,
      }),
    });
    return { inquiry: publicInquiry, storage: "supabase" };
  }

  const database = readLocalDatabase();
  if (isRecentDuplicateByPhone(database.inquiries || [], publicInquiry.phone)) throw duplicateError();
  const nextDatabase = writeLocalDatabase({
    ...database,
    inquiries: [publicInquiry, ...(database.inquiries || [])].slice(0, 500),
  });

  return {
    inquiry: publicInquiry,
    storedInquiries: nextDatabase.inquiries.length,
    storage: "json_fallback",
  };
}

export async function updateLeadPipeline(leadId, updates, userId, pipelineEvent) {
  assertStorageAvailable();
  if (!userId) throw new Error("userId is required to update CRM data.");
  if (!pipelineEvent?.id) throw new Error("pipeline event id is required to update CRM data.");
  if (pipelineEvent.userId !== userId) throw new Error("pipeline event userId must match the workspace.");
  if (pipelineEvent.leadId !== leadId) throw new Error("pipeline event leadId must match the updated lead.");
  const notFoundError = new Error("Lead not found in this workspace.");
  notFoundError.statusCode = 404;

  if (getSupabaseConfig()) {
    const body = {
      status: updates.status,
      pipeline_stage: updates.pipelineStage || updates.status,
      updated_at: new Date().toISOString(),
    };
    const [lead] = await supabaseRequest(`leads?id=eq.${encodeURIComponent(leadId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!lead) throw notFoundError;
    await recordEvent(pipelineEvent);
    return { lead, storage: "supabase" };
  }

  const database = readLocalDatabase();
  const existingLead = (database.leads || []).find((lead) => lead.id === leadId && lead.userId === userId);
  if (!existingLead) throw notFoundError;

  const leads = (database.leads || []).map((lead) => (
    lead.id === leadId && lead.userId === userId
      ? { ...lead, ...updates, updatedAt: new Date().toISOString() }
      : lead
  ));
  writeLocalDatabase({
    ...database,
    leads,
    events: [pipelineEvent, ...(database.events || [])].slice(0, 1000),
  });
  return { lead: leads.find((lead) => lead.id === leadId && lead.userId === userId), storage: "json_fallback" };
}

export async function updateUserSubscription(subscription, subscriptionEvent) {
  assertStorageAvailable();
  const { userId, plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd } = subscription || {};
  if (!userId) throw new Error("userId is required to update subscription.");
  if (!subscription?.id) throw new Error("subscription id is required to update subscription.");
  if (!subscriptionEvent?.id) throw new Error("subscription event id is required to update subscription.");
  if (subscriptionEvent.userId !== userId) throw new Error("subscription event userId must match the workspace.");

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

    const existing = await supabaseRequest(`subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
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
  const users = (database.users || []).map((user) => (
    user.id === userId
      ? { ...user, plan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus: status, updatedAt: timestamp }
      : user
  ));
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
