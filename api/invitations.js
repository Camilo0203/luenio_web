import { createSessionToken, getSessionUser, setSessionCookie } from "./services/auth-service.js";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  revokeInvitation,
} from "./services/invitation-service.js";
import { sendApiError } from "./services/http-response.js";

function invitationErrorStatus(error) {
  if (error.statusCode) return error.statusCode;
  return /^(Invitation|A valid email|Business name|A user with this email|Password)/.test(
    String(error.message || ""),
  )
    ? 400
    : 500;
}

export default async function handler(request, response) {
  try {
    if (request.method === "POST" && request.pathname?.endsWith("/accept")) {
      const user = await acceptInvitation({
        token: request.body?.token,
        password: request.body?.password,
      });
      if (user.role === "admin") {
        return response.status(200).json({
          ok: true,
          user,
          authenticated: false,
          mfaRequired: true,
        });
      }
      setSessionCookie(
        response,
        await createSessionToken(user, {
          clientIp: request.clientIp,
          userAgent: request.headers?.["user-agent"],
        }),
      );
      return response.status(200).json({ ok: true, user, authenticated: true });
    }

    const actor = await getSessionUser(request);
    if (!actor) return response.status(401).json({ ok: false, error: "Authentication required." });

    if (request.method === "GET") {
      return response.status(200).json({ ok: true, invitations: await listInvitations(actor) });
    }
    if (request.method === "POST" && request.pathname?.endsWith("/revoke")) {
      const invitation = await revokeInvitation({
        invitationId: request.body?.invitationId,
        actor,
      });
      return response.status(200).json({ ok: true, invitation });
    }
    if (request.method === "POST") {
      const result = await createInvitation({ body: request.body || {}, actor });
      return response.status(201).json({ ok: true, ...result });
    }
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendApiError(response, error, { status: invitationErrorStatus(error) });
  }
}
