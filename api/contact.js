import {
  capturePublicInquiryFromBody,
  PublicInquiryValidationError,
} from "./services/contact-service.js";
import { sendApiError } from "./services/http-response.js";
import { logInfo } from "./services/logger.js";
import { PublicInquirySecurityError } from "./services/turnstile-service.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const stored = await capturePublicInquiryFromBody(request.body || {}, {
      headers: request.headers,
      clientIp: request.clientIp,
    });
    logInfo("contact.inquiry.stored", {
      requestId: request.requestId,
      inquiryId: stored.inquiry.id,
      notificationDelivered: stored.webhook?.status === "sent",
    });

    return response.status(200).json(stored.publicResponse);
  } catch (error) {
    if (error instanceof PublicInquirySecurityError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Security verification failed",
        code: error.code,
      });
    }
    if (error instanceof PublicInquiryValidationError) {
      return response.status(error.statusCode).json({
        ok: false,
        error: "Missing required fields",
        missingFields: error.missingFields,
      });
    }

    console.error("[Luenio Contact] POST /api/contact failed", error);
    return sendApiError(response, error);
  }
}
