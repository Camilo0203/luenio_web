// Unit coverage for api/services/lead-validation-service.js, extracted from
// lead-processing-service.js. Pure functions, no storage/network needed.
import assert from "node:assert/strict";
import {
  LeadValidationError,
  PipelineStageValidationError,
  assertValidLead,
  isLeadUpdateRequest,
  isPipelineOnlyUpdate,
  leadMatchesQuery,
} from "../api/services/lead-validation-service.js";

const validLead = { name: "Ana", business: "Nova", phone: "+573001112233", service: "CRM" };

// assertValidLead
assert.doesNotThrow(() => assertValidLead(validLead), "A lead with all required fields must pass.");
assert.throws(
  () => assertValidLead({ name: "Ana" }),
  (error) => {
    assert.ok(error instanceof LeadValidationError, "Must throw LeadValidationError.");
    assert.equal(error.statusCode, 400);
    assert.deepEqual(
      [...error.missingFields].sort(),
      ["business", "phone", "service"],
      "missingFields must list every absent required field.",
    );
    return true;
  },
);
assert.throws(
  () => assertValidLead({}),
  (error) => {
    assert.deepEqual([...error.missingFields].sort(), ["business", "name", "phone", "service"]);
    return true;
  },
  "An empty lead must be missing all four required fields.",
);

// PipelineStageValidationError
{
  const withDefault = new PipelineStageValidationError();
  assert.equal(withDefault.message, "Invalid pipeline stage.");
  assert.equal(withDefault.statusCode, 400);
  const withCustom = new PipelineStageValidationError("Contact log summary is required.");
  assert.equal(withCustom.message, "Contact log summary is required.");
}

// isLeadUpdateRequest
assert.equal(isLeadUpdateRequest({}), false, "No leadId must never be an update request.");
assert.equal(isLeadUpdateRequest({ leadId: "l1" }), false, "leadId alone has no update field.");
assert.equal(isLeadUpdateRequest({ leadId: "l1", status: "qualified" }), true);
assert.equal(
  isLeadUpdateRequest({ leadId: "l1", notes: "" }),
  true,
  "An explicit empty-string field still counts (checked with !== undefined, not truthiness).",
);
assert.equal(isLeadUpdateRequest({ leadId: "l1", contactLogEntry: { summary: "Llamó" } }), true);
assert.equal(
  isLeadUpdateRequest({ status: "qualified" }),
  false,
  "No leadId disqualifies even with other fields.",
);

// isPipelineOnlyUpdate
assert.equal(isPipelineOnlyUpdate({ status: "qualified" }), true);
assert.equal(isPipelineOnlyUpdate({ status: "qualified", pipelineStage: "qualified" }), true);
assert.equal(
  isPipelineOnlyUpdate({ status: "qualified", notes: "x" }),
  false,
  "Any non-pipeline key disqualifies the fast path.",
);
assert.equal(
  isPipelineOnlyUpdate({ notes: "x" }),
  false,
  "No status key can never be pipeline-only.",
);
assert.equal(isPipelineOnlyUpdate({}), false);

// leadMatchesQuery
const lead = {
  name: "Ana Pérez",
  business: "Nova Studio",
  phone: "+573001112233",
  service: "Automatización de WhatsApp",
  message: "Quiero cotización",
  source: "hero",
  notes: "Cliente interesado",
  nextAction: "Llamar mañana",
  tags: ["urgente", "vip"],
};
assert.equal(leadMatchesQuery(lead, ""), true, "An empty query must always match.");
assert.equal(leadMatchesQuery(lead, "nova"), true, "Match is case-insensitive on business.");
assert.equal(leadMatchesQuery(lead, "urgente"), true, "Match must include tags.");
assert.equal(leadMatchesQuery(lead, "llamar"), true, "Match must include nextAction.");
assert.equal(leadMatchesQuery(lead, "nonexistent"), false);

console.info("Lead validation service guard passed");
