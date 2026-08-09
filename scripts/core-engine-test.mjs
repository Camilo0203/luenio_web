import {
  buildAutomationPlan,
  generateRecordId,
  leadFieldLimits,
  normalizeLead,
  normalizeTags,
  scoreLead,
} from "../core/engine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const generatedIds = new Set(Array.from({ length: 50 }, () => generateRecordId("Lead Record")));
assert(generatedIds.size === 50, "Core record ids must be unique across rapid generation.");
assert(
  [...generatedIds].every((id) => /^lead_record_\d+_[a-f0-9]{32}$/.test(id)),
  "Core record ids must use normalized prefixes and strong hex entropy.",
);

const spoofedLead = normalizeLead({
  id: "client_controlled_id",
  name: "Score Spoof",
  business: "Untrusted Client",
  phone: "+57 300 111 2233",
  service: "Consulta general",
  message: "Solo estoy mirando, tal vez mas adelante.",
  source: "unknown",
  score: 100,
  scoreReasons: ["client_score"],
  status: "converted",
  pipelineStage: "converted",
  timestamp: "1999-01-01T00:00:00.000Z",
  updatedAt: "1999-01-01T00:00:00.000Z",
});

assert(spoofedLead.id !== "client_controlled_id", "Core must generate server-owned lead ids.");
assert(spoofedLead.id.startsWith("lead_"), "Core-generated lead ids must use the lead prefix.");
assert(
  spoofedLead.timestamp !== "1999-01-01T00:00:00.000Z",
  "Core must generate server-owned timestamps.",
);
assert(
  spoofedLead.updatedAt !== "1999-01-01T00:00:00.000Z",
  "Core must generate server-owned update timestamps.",
);
assert(spoofedLead.score < 80, "Core scoring must ignore client-provided score values.");
assert(
  spoofedLead.classification !== "hot",
  "Client-provided scores must not force hot classification.",
);
assert(
  !spoofedLead.scoreReasons.includes("client_score"),
  "Core scoring must not persist client-provided score reasons.",
);
assert(
  spoofedLead.pipelineStage !== "converted",
  "Client input must not force a converted pipeline stage.",
);

const oversizedLead = normalizeLead({
  name: "A".repeat(200),
  business: "B".repeat(200),
  phone: "+57 300 111 2233 extension ".repeat(8),
  service: "S".repeat(200),
  message: "M".repeat(2000),
  source: "Hero CTA <script>alert(1)</script>",
});

assert(oversizedLead.name.length === leadFieldLimits.name, "Lead name must be bounded.");
assert(
  oversizedLead.business.length === leadFieldLimits.business,
  "Lead business must be bounded.",
);
assert(oversizedLead.phone.length === leadFieldLimits.phone, "Lead phone must be bounded.");
assert(oversizedLead.service.length === leadFieldLimits.service, "Lead service must be bounded.");
assert(oversizedLead.message.length === leadFieldLimits.message, "Lead message must be bounded.");
assert(
  !/[<>\s]/.test(oversizedLead.source),
  "Lead source must be normalized for storage and analytics.",
);

const highIntentLead = normalizeLead({
  name: "High Intent",
  business: "Ready Business",
  phone: "+57 300 999 8877",
  service: "Automatizacion de WhatsApp",
  message: "Quiero automatizar mis ventas, necesito cotizacion y precio para empezar ahora.",
  source: "contacto",
});

assert(highIntentLead.score >= 80, "High-intent lead should still score as hot.");
assert(highIntentLead.classification === "hot", "High-intent lead should classify as hot.");

const unrestrictedPlan = buildAutomationPlan(highIntentLead);
assert(
  /^action_\d+_[a-f0-9]{32}$/.test(unrestrictedPlan.id),
  "Automation action ids must use the shared secure id format.",
);
assert(
  unrestrictedPlan.actions.includes("send_crm_webhook"),
  "Core automation plan must describe the full workflow before plan filtering.",
);

const restrictedPlan = buildAutomationPlan(highIntentLead, {
  allowedActions: ["create_crm_deal", "assign_sales_owner"],
});
assert(
  restrictedPlan.actions.length === 2,
  "Core automation plan must honor explicit allowed actions.",
);
assert(
  restrictedPlan.restrictedActions.includes("send_crm_webhook"),
  "Core automation plan must report actions excluded by caller policy.",
);

const tags = normalizeTags([" WhatsApp ", "urgente", "urgente", "x".repeat(80), ""]);
assert(tags.includes("whatsapp"), "Tags must normalize case and spacing.");
assert(tags.filter((tag) => tag === "urgente").length === 1, "Tags must de-duplicate.");
assert(
  tags.every((tag) => tag.length <= leadFieldLimits.tag),
  "Tags must respect max length.",
);

const taggedLead = normalizeLead({
  name: "Tagged",
  business: "Biz",
  phone: "+57 300 111 2233",
  service: "CRM",
  message: "Necesito presupuesto esta semana para contratar automatizacion.",
  notes: "Llamar manana",
  tags: "demo, prioritario",
});
assert(taggedLead.notes === "Llamar manana", "Lead notes must be preserved and normalized.");
assert(taggedLead.tags.includes("demo"), "Lead tags must be accepted from string input.");
assert(
  scoreLead({
    service: "cotizar",
    message: "quiero presupuesto urgente esta semana",
    phone: "+57 300 111 2233",
    source: "pricing",
  }).score >= 60,
  "Expanded Spanish intent lexicon must increase scores for commercial language.",
);

console.info("Core engine trust boundary passed");
