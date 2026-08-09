export const pipelineStages = ["new", "qualified", "contacted", "converted"];

export function getPipelineStage(score) {
  if (score >= 95) return "converted";
  if (score >= 80) return "contacted";
  if (score >= 60) return "qualified";
  return "new";
}

export function isValidPipelineStage(stage) {
  return pipelineStages.includes(String(stage || "").trim());
}

export function normalizePipelineStage(stage) {
  const normalizedStage = String(stage || "").trim();
  return isValidPipelineStage(normalizedStage) ? normalizedStage : null;
}

export function buildWorkflow(lead) {
  if (lead.score >= 80) {
    return {
      type: "hot_lead_workflow",
      segment: "hot_leads",
      actions: [
        "create_crm_deal",
        "send_webhook",
        "send_crm_webhook",
        "send_whatsapp_notification",
        "assign_sales_owner",
      ],
    };
  }
  if (lead.score >= 60) {
    return {
      type: "sales_notification",
      segment: "qualified_leads",
      actions: ["create_crm_record", "send_webhook", "send_crm_webhook", "send_email_notification"],
    };
  }
  return {
    type: "nurture_sequence",
    segment: "nurture",
    actions: [
      "create_crm_record",
      "add_to_nurture_segment",
      "schedule_followup",
      "send_webhook",
      "send_crm_webhook",
    ],
  };
}
