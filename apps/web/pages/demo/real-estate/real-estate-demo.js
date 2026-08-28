import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "real-estate",
  initialStatus: "Esperando consulta de comprador",
  completedStatus: "Demo completada: comprador asignado a asesor",
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
  bindInitial: [{ selector: "#realEstatePain", value: (scenario) => scenario.pain }],
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
      status: "Lead recibido...",
      chat: { role: "customer", text: "lead.message" },
      event: {
        label: "Consulta de comprador recibida",
        detail: "Comprador compartió zona y presupuesto desde la landing.",
      },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analizando intención...",
      event: {
        label: "Presupuesto clasificado por reglas",
        detail: "La simulación clasifica presupuesto, zona e intención de visita.",
      },
    },
    {
      delay: 1800,
      advanceIndex: 2,
      status: (scenario) =>
        `Lead calificado: ${CLASSIFICATION_LABELS[scenario.lead.classification] ?? scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: {
          label: "Actualización de CRM",
          detail: "Comprador añadido a Pipeline de compradores.",
        },
      },
    },
    {
      delay: 2900,
      advanceIndex: 3,
      status: "Enviado al CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: {
          label: "Asesor asignado",
          detail: "Asesor asignado con presupuesto y propiedad sugerida.",
        },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Automatización activada",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 2,
        event: {
          label: "Flujo de visita",
          detail: "Seguimiento automático creado para agendar visita.",
        },
      },
    },
  ],
});
