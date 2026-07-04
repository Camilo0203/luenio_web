import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

mountIndustryDemo({
  type: "restaurants",
  initialStatus: "Waiting for restaurant inquiry",
  completedStatus: "Demo completed: slow response avoided",
  selectors: {
    links: "#industryLinks",
    button: "#runRestaurantDemo",
    status: "#restaurantLiveStatus",
    chat: "#restaurantChatThread",
    events: "#restaurantEvents",
    pipeline: "#restaurantPipeline",
    score: "#restaurantLeadScore",
  },
  bindInitial: [
    { selector: "#restaurantPain", value: (scenario) => scenario.pain },
  ],
  resetFields: [
    { selector: "#restaurantCaptureStatus", value: "Esperando mensaje" },
    { selector: "#restaurantLeadScore", value: "--" },
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
      event: { label: "Lead received", detail: "Cliente preguntó por menú en WhatsApp." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analyzing intent...",
      event: { label: "Analyzing intent", detail: "IA detecta intención de pedido." },
    },
    {
      delay: 1800,
      advanceIndex: 2,
      status: (scenario) => `Lead scored: ${scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        stageIndex: 1,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Pedido capturado" }],
        event: { label: "Pedido capturado", detail: "Intento de compra detectado. Lead marcado HOT." },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Sent to CRM",
      crm: {
        stageIndex: 1,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Enviado al CRM" }],
        event: { label: "Sent to CRM", detail: "Cliente movido al pipeline HOT." },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Automation triggered",
      crm: {
        stageIndex: 2,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Automatización activa" }],
        event: { label: "Automation triggered", detail: "Menú enviado, pedido solicitado y seguimiento creado." },
      },
    },
  ],
});
