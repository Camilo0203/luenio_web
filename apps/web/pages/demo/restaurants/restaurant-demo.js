import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "restaurants",
  initialStatus: "Esperando consulta de restaurante",
  completedStatus: "Demo completada: respuesta lenta evitada",
  selectors: {
    links: "#industryLinks",
    button: "#runRestaurantDemo",
    status: "#restaurantLiveStatus",
    chat: "#restaurantChatThread",
    events: "#restaurantEvents",
    pipeline: "#restaurantPipeline",
    score: "#restaurantLeadScore",
  },
  bindInitial: [{ selector: "#restaurantPain", value: (scenario) => scenario.pain }],
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
      status: "Lead recibido...",
      chat: { role: "customer", text: "lead.message" },
      event: { label: "Lead recibido", detail: "Cliente preguntó por menú en WhatsApp." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analizando intención...",
      event: { label: "Analizando intención", detail: "IA detecta intención de pedido." },
    },
    {
      delay: 1800,
      advanceIndex: 2,
      status: (scenario) =>
        `Lead calificado: ${CLASSIFICATION_LABELS[scenario.lead.classification] ?? scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        stageIndex: 1,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Pedido capturado" }],
        event: {
          label: "Pedido capturado",
          detail: "Intento de compra detectado. Lead marcado CALIENTE.",
        },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Enviado al CRM",
      crm: {
        stageIndex: 1,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Enviado al CRM" }],
        event: { label: "Enviado al CRM", detail: "Cliente movido al pipeline CALIENTE." },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Automatización activada",
      crm: {
        stageIndex: 2,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        fields: [{ selector: "#restaurantCaptureStatus", value: "Automatización activa" }],
        event: {
          label: "Automatización activada",
          detail: "Menú enviado, pedido solicitado y seguimiento creado.",
        },
      },
    },
  ],
});
