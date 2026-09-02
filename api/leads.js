import { requireUser } from "./services/auth-service.js";
import { sendApiError } from "./services/http-response.js";
import { captureCrmLeadFromBody } from "./services/lead-capture-service.js";
import { importCrmLeadsFromRows } from "./services/lead-import-service.js";
import { listCrmWorkspace } from "./services/lead-workspace-service.js";
import {
  LeadValidationError,
  PipelineStageValidationError,
} from "./services/lead-validation-service.js";

export default async function handler(request, response) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return sendApiError(response, error, { status: 401 });
  }

  if (request.method === "GET") {
    try {
      const query = request.query || {};
      const data = await listCrmWorkspace(user, {
        q: query.q || query.search || "",
        limit: query.limit,
        cursor: query.cursor || "",
      });
      return response.status(200).json(data);
    } catch (error) {
      console.error("[Luenio API] GET /api/leads failed", error);
      return sendApiError(response, error, { status: 500 });
    }
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = request.body || {};
    if (body.mode === "import") {
      const result = await importCrmLeadsFromRows({ body, user });
      return response.status(200).json(result.response);
    }

    const result = await captureCrmLeadFromBody({ body, user });
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
    if (error instanceof PipelineStageValidationError) {
      return response.status(400).json({ ok: false, error: "Invalid import payload." });
    }

    console.error("[Luenio API] POST /api/leads failed", error);
    return sendApiError(response, error);
  }
}
