import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

mountIndustryDemo({
  type: "gym",
  initialStatus: "Waiting for price inquiry",
  completedStatus: "Demo completed: inquiry moved toward membership",
  selectors: {
    links: "#industryLinks",
    button: "#runGymDemo",
    status: "#gymLiveStatus",
    chat: "#gymChatThread",
    events: "#gymEvents",
    pipeline: "#gymPipeline",
    leadName: "#gymLeadName",
    score: "#gymLeadScore",
  },
  bindInitial: [{ selector: "#gymPain", value: (scenario) => scenario.pain }],
  lists: [
    {
      selector: "#gymPricingCards",
      dataKey: "pricing",
      template: (plan, _index, escapeHtml) => `
        <article>
          <span>${escapeHtml(plan.name)}</span>
          <strong>${escapeHtml(plan.price)}</strong>
          <p>${escapeHtml(plan.detail)}</p>
        </article>
      `,
    },
  ],
  resetFields: [
    { selector: "#gymLeadName", value: "Esperando consulta" },
    { selector: "#gymLeadScore", value: "--" },
  ],
  initialCrm: {
    stageIndex: 0,
  },
  steps: [
    {
      delay: 0,
      advanceIndex: 0,
      status: "Lead received...",
      chat: { role: "customer", text: "lead.message" },
      event: { label: "Lead received", detail: "Consulta por mensualidad recibida en WhatsApp." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analyzing intent...",
      event: {
        label: "Interest detected",
        detail: "La IA detectó intención por precio y posible visita.",
      },
    },
    {
      delay: 1700,
      advanceIndex: 2,
      status: (scenario) => `Lead scored: ${scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        event: { label: "CRM update", detail: "Lead añadido a Interested Leads." },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Sent to CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        event: { label: "CRM update", detail: "CRM actualizado con interés en membresía." },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Follow-up automation triggered",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 2,
        event: {
          label: "Automation triggered",
          detail: "Planes enviados + visita sugerida + recordatorio programado.",
        },
      },
    },
  ],
});
