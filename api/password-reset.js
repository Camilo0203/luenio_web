import { confirmPasswordReset, requestPasswordReset } from "./services/password-reset-service.js";
import { sendApiError } from "./services/http-response.js";

function resetErrorStatus(error) {
  if (error.statusCode) return error.statusCode;
  return /^(Reset link|Password)/.test(String(error.message || "")) ? 400 : 500;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    if (request.pathname.endsWith("/confirm")) {
      await confirmPasswordReset({ token: request.body?.token, password: request.body?.password });
      return response.status(200).json({ ok: true });
    }
    await requestPasswordReset(request.body?.email);
    return response.status(200).json({
      ok: true,
      message: "If the account exists, a recovery link will be sent.",
    });
  } catch (error) {
    return sendApiError(response, error, { status: resetErrorStatus(error) });
  }
}
