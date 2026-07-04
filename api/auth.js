import {
  clearSessionCookie,
  setSessionCookie,
} from "./services/auth-service.js";
import {
  getAuthErrorStatus,
  getAuthSession,
  loginAuthSession,
  logoutAuthSession,
  registerAuthSession,
} from "./services/auth-flow-service.js";
import { sendApiError } from "./services/http-response.js";

function sendAuthResult(response, result) {
  if (result.sessionToken) setSessionCookie(response, result.sessionToken);
  if (result.clearSession) clearSessionCookie(response);
  return response.status(result.status).json(result.body);
}

export default async function handler(request, response) {
  const body = request.body || {};
  const action = body.action || request.query?.action;

  try {
    if (request.method === "GET") {
      return sendAuthResult(response, await getAuthSession(request));
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (action === "register") {
      return sendAuthResult(response, await registerAuthSession(body));
    }

    if (action === "login") {
      return sendAuthResult(response, await loginAuthSession(body));
    }

    if (action === "logout") {
      return sendAuthResult(response, logoutAuthSession());
    }

    return response.status(400).json({ ok: false, error: "Unknown auth action." });
  } catch (error) {
    return sendApiError(response, error, { status: getAuthErrorStatus(error), includeStorage: true });
  }
}
