import { getClassification } from "./format.js";
import { state } from "./state.js";

export function normalizeLeadFromApi(lead) {
  const rawTags = lead.tags ?? [];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : String(rawTags || "")
        .split(/[,;]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
  const contactLog = Array.isArray(lead.contactLog)
    ? lead.contactLog
    : Array.isArray(lead.contact_log)
      ? lead.contact_log
      : [];

  return {
    id: lead.id,
    name: lead.name,
    business: lead.business,
    phone: lead.phone,
    service: lead.service,
    message: lead.message,
    source: lead.source,
    notes: lead.notes || "",
    tags,
    nextAction: lead.nextAction || lead.next_action || "",
    nextActionAt: lead.nextActionAt || lead.next_action_at || null,
    lastContactedAt: lead.lastContactedAt || lead.last_contacted_at || null,
    assigneeUserId: lead.assigneeUserId || lead.assignee_user_id || null,
    contactLog,
    score: lead.score,
    classification: getClassification(lead),
    status: lead.pipeline_stage || lead.pipelineStage || lead.status || "new",
    timestamp: lead.created_at || lead.timestamp,
    scoreReasons: lead.score_reasons || lead.scoreReasons || [],
    workflow: lead.workflow,
  };
}

export function isDemoLead(leadId) {
  return String(leadId || "").startsWith("demo_lead_");
}

export function createDemoEvent(type, lead, payload = {}) {
  return {
    id: `demo_event_${Date.now()}_${type}_${lead.id}`,
    type,
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    payload: {
      source: "live_demo",
      classification: lead.classification,
      score: lead.score,
      pipelineStage: lead.status,
      ...payload,
    },
  };
}

export function createDemoLead(template, stage = "new") {
  const id = `demo_lead_${Date.now()}_${state.demo.selectedIndex}`;
  return {
    ...template,
    id,
    status: stage,
    timestamp: new Date().toISOString(),
    demo: true,
    notes: template.notes || "",
    tags: template.tags || [],
    nextAction: template.nextAction || "",
    nextActionAt: template.nextActionAt || null,
    lastContactedAt: template.lastContactedAt || null,
    assigneeUserId: template.assigneeUserId || null,
    contactLog: template.contactLog || [],
  };
}

export function getWorkspaceLeads() {
  return [...state.demoLeads, ...state.leads];
}

export function getWorkspaceEvents() {
  return [...state.demoEvents, ...state.events];
}

export function getWorkspaceActions() {
  return [...state.demoActions, ...state.actions];
}

export function getEventId(event) {
  return (
    event.id ||
    `${event.type}_${event.created_at || event.timestamp || ""}_${event.lead_id || event.leadId || ""}`
  );
}
