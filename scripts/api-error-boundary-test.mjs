import {
  getErrorStatus,
  getPublicErrorMessage,
  sendApiError,
} from "../api/services/http-response.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

const internalError = new Error("SUPABASE_SERVICE_ROLE_KEY rejected row-level policy details");
assert(getErrorStatus(internalError) === 500, "Unknown errors must default to HTTP 500.");
assert(
  getPublicErrorMessage(internalError, 500) === "Internal server error.",
  "5xx errors must not expose raw internals.",
);

const validationError = new Error("Missing required fields");
validationError.statusCode = 400;
assert(
  getPublicErrorMessage(validationError, 400) === "Missing required fields",
  "4xx operational errors must stay actionable.",
);

const paidLimitError = new Error("Lead limit reached for Starter. Upgrade your plan to continue.");
paidLimitError.statusCode = 402;
paidLimitError.usage = { used: 100, limit: 100, plan: "starter" };
const response = createMockResponse();
sendApiError(response, paidLimitError);
assert(response.statusCode === 402, "sendApiError must preserve operational status codes.");
assert(
  response.body.error === paidLimitError.message,
  "sendApiError must preserve 4xx operational messages.",
);
assert(response.body.usage?.used === 100, "sendApiError must preserve billing usage context.");
assert(!response.body.storage, "API errors must never expose storage infrastructure.");

const unsafeResponse = createMockResponse();
sendApiError(unsafeResponse, internalError);
assert(unsafeResponse.statusCode === 500, "sendApiError must return 500 for unknown errors.");
assert(
  unsafeResponse.body.error === "Internal server error.",
  "sendApiError must hide internal 5xx messages.",
);

console.info("API error boundary guard passed");
