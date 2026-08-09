import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const labels = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "aesthetics",
  initialStatus: "Esperando consulta de valoración",
  completedStatus: "Demo completada: valoración lista para confirmar",
  selectors: {
    links: "#industryLinks",
    button: "#runAestheticDemo",
    status: "#aestheticLiveStatus",
    chat: "#aestheticChatThread",
    events: "#aestheticEvents",
    pipeline: "#aestheticPipeline",
    leadName: "#aestheticLeadName",
    score: "#aestheticLeadScore",
  },
  bindInitial: [{ selector: "#aestheticPain", value: (scenario) => scenario.pain }],
  lists: [
    {
      selector: "#aestheticServices",
      dataKey: "services",
      template: (item, _index, escapeHtml) =>
        `<article><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.status)}</strong><p>${escapeHtml(item.detail)}</p></article>`,
    },
  ],
  resetFields: [
    { selector: "#aestheticLeadName", value: "Esperando consulta" },
    { selector: "#aestheticLeadScore", value: "--" },
  ],
  initialCrm: { stageIndex: 0 },
  steps: [
    {
      delay: 0,
      advanceIndex: 0,
      status: "Mensaje recibido…",
      chat: { role: "customer", text: "lead.message" },
      event: {
        label: "Mensaje recibido",
        detail: "Consulta desde Instagram con necesidad concreta.",
      },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Entendiendo necesidad…",
      event: {
        label: "Intención detectada",
        detail: "Se identificó objetivo, servicio y ventana de agenda.",
      },
    },
    {
      delay: 1700,
      advanceIndex: 2,
      status: (scenario) => `Lead calificado: ${labels[scenario.lead.classification]} 🔥`,
      chat: { role: "ai", text: "aiReply" },
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        event: {
          label: "Valoración priorizada",
          detail: "La conversación ya tiene un siguiente paso claro.",
        },
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
        event: { label: "CRM actualizado", detail: "Registro creado con servicio de interés." },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Seguimiento de agenda activado",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 2,
        event: {
          label: "Seguimiento activado",
          detail: "Espacio sugerido + confirmación programada.",
        },
      },
    },
  ],
});
