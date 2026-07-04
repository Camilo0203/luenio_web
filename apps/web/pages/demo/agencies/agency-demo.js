import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

mountIndustryDemo({
  type: "agencies",
  initialStatus: "Esperando lead de cliente",
  completedStatus: "Demo completada: oportunidad de servicio para agencia creada",
  selectors: {
    links: "#industryLinks",
    button: "#runAgencyDemo",
    status: "#agencyLiveStatus",
    events: "#agencyEvents",
    pipeline: "#agencyPipeline",
    sequence: "#agencyTriggers",
    leadName: "#agencyLeadName",
    score: "#agencyLeadScore",
  },
  bindInitial: [
    { selector: "#agencyPain", value: (scenario) => scenario.pain },
    { selector: "#agencyLeadMessage", value: "lead.message" },
  ],
  lists: [
    {
      selector: "#agencyClientList",
      dataKey: "clients",
      template: (client, _index, escapeHtml) => `
        <article>
          <span>${escapeHtml(client.status)}</span>
          <strong>${escapeHtml(client.name)}</strong>
          <p>${escapeHtml(client.detail)}</p>
        </article>
      `,
    },
    {
      selector: "#agencyTriggers",
      dataKey: "automation",
      template: (trigger, index, escapeHtml) => `
        <article>
          <span>Disparador ${index + 1}</span>
          <strong>${escapeHtml(trigger)}</strong>
        </article>
      `,
    },
  ],
  resetFields: [
    { selector: "#agencyLeadName", value: "Esperando lead" },
    { selector: "#agencyLeadScore", value: "--" },
  ],
  initialCrm: {
    stageIndex: 0,
    activeSequence: -1,
  },
  steps: [
    {
      delay: 0,
      advanceIndex: 0,
      status: "Lead recibido...",
      event: {
        label: "Lead de cliente recibido",
        detail: (scenario) => `"${scenario.lead.message}" entró desde ${scenario.lead.source}.`,
      },
    },
    {
      delay: 850,
      advanceIndex: 1,
      status: "Analizando intención...",
      crm: { stageIndex: 0, activeSequence: 0 },
      event: {
        label: "Intención analizada",
        detail: "La IA detectó necesidad de adquisición de clientes y crecimiento comercial.",
      },
    },
    {
      delay: 1650,
      advanceIndex: 2,
      status: (scenario) =>
        `Lead calificado: ${CLASSIFICATION_LABELS[scenario.lead.classification] ?? scenario.lead.classification.toUpperCase()} 🔥`,
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE`,
        stageIndex: 1,
        activeSequence: 1,
        event: {
          label: "Actualización de CRM de agencia",
          detail: "Lead calificado y servicio recomendado: IA + CRM + WhatsApp.",
        },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Enviado al CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE · Cliente de alto valor`,
        stageIndex: 1,
        activeSequence: 2,
        event: {
          label: "Actualización de CRM de agencia",
          detail: "Lead añadido a Pipeline de agencia y etiquetado como cliente de alto valor.",
        },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Automatización de reventa activada",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 CALIENTE · Cliente de alto valor`,
        stageIndex: 2,
        activeSequence: 3,
        event: {
          label: "Flujo de reventa",
          detail: "La agencia puede vender Luenio como servicio recurrente para este cliente.",
        },
      },
    },
  ],
});
