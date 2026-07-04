import { requireUser } from "./services/auth-service.js";
import { sendApiError } from "./services/http-response.js";
import { getWorkspaceSettings } from "./services/settings-service.js";

export default async function handler(request, response) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return sendApiError(response, error, { status: 401 });
  }

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return response.status(200).json({
    ok: true,
    ...getWorkspaceSettings(user),
  });
}
