import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "gym",
  initialStatus: "Esperando consulta de precio",
  completedStatus: "Demo completada: consulta convertida en membresía",
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
      status: "Lead recibido...",
      chat: { role: "customer", text: "lead.message" },
      event: { label: "Lead recibido", detail: "Consulta por mensualidad recibida en WhatsApp." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Analizando intención...",
      event: {
        label: "Interés detectado",
        detail: "La IA detectó intención por precio y posible visita.",
      },
    },
    {
      delay: 1700,
      advanceIndex: 2,
      status: (scenario) =>
        `Lead calificado: ${CLASSIFICATION_LABELS[scenario.lead.classification] ?? scenario.lead.classification.toUpperCase()} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: { label: "Actualización de CRM", detail: "Lead añadido a Leads interesados." },
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
          label: "Actualización de CRM",
          detail: "CRM actualizado con interés en membresía.",
        },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Automatización de seguimiento activada",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 2,
        event: {
          label: "Automatización activada",
          detail: "Planes enviados + visita sugerida + recordatorio programado.",
        },
      },
    },
  ],
});
