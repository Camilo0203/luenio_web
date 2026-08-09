import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const labels = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "veterinary",
  initialStatus: "Esperando consulta de mascota",
  completedStatus: "Demo completada: cita lista para confirmar",
  selectors: {
    links: "#industryLinks",
    button: "#runVetDemo",
    status: "#vetLiveStatus",
    chat: "#vetChatThread",
    events: "#vetEvents",
    pipeline: "#vetPipeline",
    leadName: "#vetLeadName",
    score: "#vetLeadScore",
  },
  bindInitial: [{ selector: "#vetPain", value: (scenario) => scenario.pain }],
  lists: [
    {
      selector: "#vetServices",
      dataKey: "services",
      template: (item, _index, escapeHtml) =>
        `<article><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.status)}</strong><p>${escapeHtml(item.detail)}</p></article>`,
    },
  ],
  resetFields: [
    { selector: "#vetLeadName", value: "Esperando consulta" },
    { selector: "#vetLeadScore", value: "--" },
  ],
  initialCrm: { stageIndex: 0 },
  steps: [
    {
      delay: 0,
      advanceIndex: 0,
      status: "Consulta recibida…",
      chat: { role: "customer", text: "lead.message" },
      event: { label: "Consulta recibida", detail: "Familia solicita atención y disponibilidad." },
    },
    {
      delay: 900,
      advanceIndex: 1,
      status: "Detectando urgencia…",
      event: {
        label: "Contexto detectado",
        detail: "Se identificó mascota, motivo y necesidad de cita.",
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
        event: { label: "Cita priorizada", detail: "Consulta marcada para atención del equipo." },
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
        event: { label: "CRM actualizado", detail: "Cita creada con motivo y siguiente paso." },
      },
    },
    {
      delay: 3800,
      advanceIndex: 4,
      status: "Recordatorio de cita activado",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 2,
        event: {
          label: "Seguimiento activado",
          detail: "Horario enviado + recordatorio programado.",
        },
      },
    },
  ],
});
