import { requireUser } from "./services/auth-service.js";
import { sendApiError } from "./services/http-response.js";
import { LeadValidationError, PipelineStageValidationError, processCrmRequestBody } from "./services/lead-processing-service.js";

export default async function handler(request, response) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return sendApiError(response, error, { status: 401, includeStorage: true });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await processCrmRequestBody({ body: request.body || {}, user });
    return response.status(200).json(result.response);
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Missing required fields",
        missingFields: error.missingFields,
      });
    }

    if (error instanceof PipelineStageValidationError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Invalid pipeline stage.",
        storage: error.storage,
      });
    }

    console.error("[Luenio API] POST /api/process failed", error);
    return sendApiError(response, error, { includeStorage: true });
  }
}
