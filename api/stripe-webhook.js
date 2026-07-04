import { sendApiError } from "./services/http-response.js";
import { processStripeWebhook, StripeWebhookError } from "./services/stripe-webhook-service.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = await processStripeWebhook({
      rawBody: request.rawBody,
      signature: request.headers?.["stripe-signature"],
    });

    return response.status(200).json(payload);
  } catch (error) {
    if (error instanceof StripeWebhookError) {
      return response.status(error.statusCode).json({ ok: false, error: error.publicMessage });
    }

    return sendApiError(response, error, { status: 500 });
  }
}
