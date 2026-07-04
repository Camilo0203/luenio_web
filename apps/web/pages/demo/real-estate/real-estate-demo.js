import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

mountIndustryDemo({
  type: "real-estate",
  initialStatus: "Waiting for buyer inquiry",
  completedStatus: "Demo completed: buyer routed to advisor",
  selectors: {
    links: "#industryLinks",
    button: "#runRealEstateDemo",
    status: "#realEstateLiveStatus",
    chat: "#realEstateChatThread",
    events: "#realEstateEvents",
    pipeline: "#realEstatePipeline",
    leadName: "#realEstateLeadName",
    score: "#realEstateLeadScore",
  },
  bindInitial: [
    { selector: "#realEstatePain", value: (scenario) => scenario.pain },
  ],
  lists: [
    {
      selector: "#realEstatePropertyList",
      dataKey: "properties",
      template: (property, _index, escapeHtml) => `
        <article>
          <span>${escapeHtml(property.status)}</span>
          <strong>${escapeHtml(property.name)}</strong>
          <p>${escapeHtml(property.detail)}</p>
        </article>
      `,
    },
  ],
  resetFields: [
    { selector: "#realEstateLeadName", value: "Esperando consulta" },
    { selector: "#realEstateLeadScore", value: "--" },
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
      event: { label: "Buyer inquiry received", detail: "Comprador compartió zona y presupuesto desde la landing." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analyzing intent...",
      event: { label: "Budget detected", detail: "IA detecta presupuesto, zona y urgencia de visita." },
    },
    {
      delay: 1800,
      advanceIndex: 2,
      status: (scenario) => `Lead scored: ${scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        event: { label: "CRM update", detail: "Comprador añadido a Buyer Pipeline." },
      },
    },
    {
      delay: 2900,
      advanceIndex: 3,
      status: "Sent to CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        event: { label: "Advisor handoff", detail: "Asesor asignado con presupuesto y propiedad sugerida." },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Automation triggered",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 2,
        event: { label: "Visit workflow", detail: "Seguimiento automático creado para agendar visita." },
      },
    },
  ],
});
