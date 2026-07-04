import { mountIndustryDemo } from "../../../src/demo-engine/industry-demo-runtime.js";

mountIndustryDemo({
  type: "agencies",
  initialStatus: "Waiting for client lead",
  completedStatus: "Demo completed: agency service opportunity created",
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
          <span>Trigger ${index + 1}</span>
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
      status: "Lead received...",
      event: {
        label: "Client lead received",
        detail: (scenario) => `"${scenario.lead.message}" entró desde ${scenario.lead.source}.`,
      },
    },
    {
      delay: 850,
      advanceIndex: 1,
      status: "Analyzing intent...",
      crm: { stageIndex: 0, activeSequence: 0 },
      event: {
        label: "Intent analyzed",
        detail: "La IA detectó necesidad de adquisición de clientes y crecimiento comercial.",
      },
    },
    {
      delay: 1650,
      advanceIndex: 2,
      status: (scenario) => `Lead scored: ${scenario.lead.classification.toUpperCase()} 🔥`,
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT`,
        stageIndex: 1,
        activeSequence: 1,
        event: {
          label: "Agency CRM update",
          detail: "Lead calificado y servicio recomendado: IA + CRM + WhatsApp.",
        },
      },
    },
    {
      delay: 2800,
      advanceIndex: 3,
      status: "Sent to CRM",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT · High-value client`,
        stageIndex: 1,
        activeSequence: 2,
        event: {
          label: "Agency CRM update",
          detail: "Lead añadido a Agency Pipeline y etiquetado como high-value client.",
        },
      },
    },
    {
      delay: 3900,
      advanceIndex: 4,
      status: "Resell automation triggered",
      crm: {
        leadName: (scenario) => scenario.lead.name,
        score: (scenario) => `${scenario.lead.score}/100 HOT · High-value client`,
        stageIndex: 2,
        activeSequence: 3,
        event: {
          label: "Resell workflow",
          detail: "La agencia puede vender Luenio como servicio recurrente para este cliente.",
        },
      },
    },
  ],
});
