import { requireUser } from "./services/auth-service.js";
import { sendApiError } from "./services/http-response.js";
import {
  captureCrmLeadFromBody,
  LeadValidationError,
  listCrmWorkspace,
} from "./services/lead-processing-service.js";

export default async function handler(request, response) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return sendApiError(response, error, { status: 401, includeStorage: true });
  }

  if (request.method === "GET") {
    try {
      const data = await listCrmWorkspace(user);
      return response.status(200).json(data);
    } catch (error) {
      console.error("[Luenio API] GET /api/leads failed", error);
      return sendApiError(response, error, { status: 500, includeStorage: true });
    }
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await captureCrmLeadFromBody({ body: request.body || {}, user });
    console.info("[Luenio CRM] Lead stored", result.log);
    return response.status(200).json(result.response);
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Missing required fields",
        missingFields: error.missingFields,
      });
    }

    console.error("[Luenio API] POST /api/leads failed", error);
    return sendApiError(response, error, { includeStorage: true });
  }
}
