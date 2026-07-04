import { capturePublicInquiryFromBody, PublicInquiryValidationError } from "./services/contact-service.js";
import { sendApiError } from "./services/http-response.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const stored = await capturePublicInquiryFromBody(request.body || {});
    console.info("[Luenio Contact] Inquiry stored", {
      inquiryId: stored.inquiry.id,
      storage: stored.storage,
      webhook: stored.webhook?.status,
    });

    return response.status(200).json(stored.publicResponse);
  } catch (error) {
    if (error instanceof PublicInquiryValidationError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Missing required fields",
        missingFields: error.missingFields,
      });
    }

    console.error("[Luenio Contact] POST /api/contact failed", error);
    return sendApiError(response, error, { includeStorage: true });
  }
}
