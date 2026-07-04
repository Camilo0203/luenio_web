import { requireUser } from "./services/auth-service.js";
import { createBillingCheckout, getBillingOverview } from "./services/billing-service.js";
import { sendApiError } from "./services/http-response.js";

export default async function handler(request, response) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return sendApiError(response, error, { status: 401 });
  }

  if (request.method === "GET") {
    const overview = await getBillingOverview(user);
    return response.status(200).json({ ok: true, ...overview });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const planId = request.body?.plan || "starter";
    const checkout = await createBillingCheckout({ user, planId, request });
    return response.status(200).json({ ok: true, url: checkout.url, id: checkout.id });
  } catch (error) {
    return sendApiError(response, error);
  }
}
