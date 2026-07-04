import { generateRecordId } from "./ids.js";

export function createDomainEvent({ userId, leadId = null, type, payload = {}, timestamp = new Date().toISOString() }) {
  if (!userId) throw new Error("userId is required to create a domain event.");
  if (!type) throw new Error("event type is required.");

  return {
    id: generateRecordId("event"),
    userId,
    leadId,
    type,
    payload,
    timestamp,
  };
}

export function buildLeadNotification({ userId, lead, actionLog }) {
  return {
    id: generateRecordId("notification"),
    userId,
    leadId: lead.id,
    workflow: actionLog.workflow,
    classification: lead.classification,
    timestamp: actionLog.timestamp,
    summary: `${lead.name} de ${lead.business} fue clasificado como ${lead.classification}.`,
  };
}

export function buildLeadLifecycleEvents({ userId, lead, actionLog }) {
  const basePayload = {
    score: lead.score,
    classification: lead.classification,
    pipelineStage: lead.pipelineStage,
    workflow: actionLog.workflow,
  };

  return [
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "message.received",
      payload: {
        source: lead.source,
        service: lead.service,
      },
    }),
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "intent.classified",
      payload: {
        ...basePayload,
        scoreReasons: lead.scoreReasons || [],
      },
    }),
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "crm.updated",
      payload: {
        ...basePayload,
        action: actionLog.actions?.includes("create_crm_deal") ? "deal_created" : "record_created",
      },
    }),
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "followup.triggered",
      payload: {
        ...basePayload,
        restrictedActions: actionLog.restrictedActions || [],
        actions: actionLog.actions || [],
      },
    }),
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "automation.triggered",
      payload: {
        ...basePayload,
        integrations: actionLog.integrationResults || [],
      },
    }),
    createDomainEvent({
      userId,
      leadId: lead.id,
      type: "lead.created",
      payload: basePayload,
    }),
  ];
}

export function buildPipelineUpdatedEvent({ userId, leadId, updates }) {
  return createDomainEvent({
    userId,
    leadId,
    type: "pipeline.updated",
    payload: {
      status: updates.status,
      pipelineStage: updates.pipelineStage || updates.status,
    },
  });
}

export function buildSubscriptionUpdatedEvent({ userId, subscription }) {
  return createDomainEvent({
    userId,
    type: "subscription.updated",
    payload: subscription,
  });
}
