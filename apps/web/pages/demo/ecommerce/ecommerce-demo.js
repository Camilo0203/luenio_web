import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

mountIndustryDemo({
  type: "ecommerce",
  initialStatus: "Waiting for product inquiry",
  completedStatus: "Demo completed: abandoned chat recovered",
  selectors: {
    links: "#industryLinks",
    button: "#runEcommerceDemo",
    status: "#ecommerceLiveStatus",
    chat: "#ecommerceChatThread",
    events: "#ecommerceEvents",
    pipeline: "#ecommercePipeline",
    leadName: "#ecommerceLeadName",
    score: "#ecommerceLeadScore",
  },
  bindInitial: [
    { selector: "#ecommercePain", value: (scenario) => scenario.pain },
  ],
  lists: [
    {
      selector: "#ecommerceInventoryList",
      dataKey: "inventory",
      template: (item, _index, escapeHtml) => `
        <article>
          <span>${escapeHtml(item.status)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </article>
      `,
    },
  ],
  resetFields: [
    { selector: "#ecommerceLeadName", value: "Esperando consulta" },
    { selector: "#ecommerceLeadScore", value: "--" },
    { selector: "#ecommerceConversionValue", value: "Recovered revenue: $0" },
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
      event: { label: "Product inquiry received", detail: "El comprador preguntó por disponibilidad antes de abandonar el chat." },
    },
    {
      delay: 850,
      advanceIndex: 1,
      status: "Tracking purchase intent...",
      event: { label: "Purchase intent detected", detail: "La IA detectó intención de compra por disponibilidad de producto." },
    },
    {
      delay: 1650,
      advanceIndex: 2,
      status: (scenario) => `Lead scored: ${scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      fields: [{ selector: "#ecommerceConversionValue", value: "Recovered revenue: $129" }],
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        event: { label: "CRM update", detail: "Comprador añadido a Sales Pipeline." },
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
        event: { label: "Inventory response sent", detail: "Disponibilidad confirmada + alternativa sugerida en segundos." },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Conversion automation triggered",
      fields: [{ selector: "#ecommerceConversionValue", value: "Recovered revenue: $258" }],
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 2,
        event: { label: "Sale recovery flow", detail: "El chat abandonado queda convertido en oportunidad activa." },
      },
    },
  ],
});
