import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "ecommerce",
  initialStatus: "Esperando consulta de producto",
  completedStatus: "Demo completada: chat abandonado recuperado",
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
  bindInitial: [{ selector: "#ecommercePain", value: (scenario) => scenario.pain }],
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
    { selector: "#ecommerceConversionValue", value: "Ingreso recuperado: $0" },
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
      event: {
        label: "Consulta de producto recibida",
        detail: "El comprador preguntó por disponibilidad antes de abandonar el chat.",
      },
    },
    {
      delay: 850,
      advanceIndex: 1,
      status: "Rastreando intención de compra...",
      event: {
        label: "Intención de compra detectada",
        detail: "La IA detectó intención de compra por disponibilidad de producto.",
      },
    },
    {
      delay: 1650,
      advanceIndex: 2,
      status: (scenario) =>
        `Lead calificado: ${CLASSIFICATION_LABELS[scenario.lead.classification] ?? scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      fields: [{ selector: "#ecommerceConversionValue", value: "Ingreso recuperado: $129" }],
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: { label: "Actualización de CRM", detail: "Comprador añadido a Pipeline de ventas." },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Enviado al CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: {
          label: "Respuesta de inventario enviada",
          detail: "Disponibilidad confirmada + alternativa sugerida en segundos.",
        },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Automatización de conversión activada",
      fields: [{ selector: "#ecommerceConversionValue", value: "Ingreso recuperado: $258" }],
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 2,
        event: {
          label: "Flujo de recuperación de venta",
          detail: "El chat abandonado queda convertido en oportunidad activa.",
        },
      },
    },
  ],
});
