import authHandler from "./auth.js";
import billingHandler from "./billing.js";
import contactHandler from "./contact.js";
import healthHandler from "./health.js";
import leadsHandler from "./leads.js";
import invitationsHandler from "./invitations.js";
import processHandler from "./process.js";
import passwordResetHandler from "./password-reset.js";
import publicConfigHandler from "./public-config.js";
import settingsHandler from "./settings.js";
import stripeWebhookHandler from "./stripe-webhook.js";
import crmHandler from "./crm.js";

const apiHandlers = {
  "/api/auth": authHandler,
  "/api/billing": billingHandler,
  "/api/contact": contactHandler,
  "/api/health": healthHandler,
  "/api/leads": leadsHandler,
  "/api/invitations": invitationsHandler,
  "/api/invitations/accept": invitationsHandler,
  "/api/invitations/revoke": invitationsHandler,
  "/api/process": processHandler,
  "/api/password-reset/request": passwordResetHandler,
  "/api/password-reset/confirm": passwordResetHandler,
  "/api/public-config": publicConfigHandler,
  "/api/settings": settingsHandler,
};

export function isApiRoute(pathname) {
  return (
    pathname === "/api/stripe-webhook" ||
    pathname === "/api/crm" ||
    pathname.startsWith("/api/crm/") ||
    Boolean(apiHandlers[pathname])
  );
}

export async function handleApiRoute({
  pathname,
  request,
  response,
  createResponse,
  parseBody,
  parseRawBody,
}) {
  if (pathname === "/api/stripe-webhook") {
    const rawBody = await parseRawBody(request);
    await stripeWebhookHandler(
      {
        method: request.method,
        headers: request.headers,
        rawBody,
        clientIp: request.clientIp,
        requestId: request.requestId,
      },
      createResponse(response),
    );
    return true;
  }

  if (pathname === "/api/crm" || pathname.startsWith("/api/crm/")) {
    await crmHandler(
      {
        method: request.method,
        headers: request.headers,
        query: request.query,
        pathname,
        clientIp: request.clientIp,
        requestId: request.requestId,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await parseBody(request),
      },
      createResponse(response),
    );
    return true;
  }

  const handler = apiHandlers[pathname];
  if (!handler) return false;

  await handler(
    {
      method: request.method,
      headers: request.headers,
      query: request.query,
      pathname,
      clientIp: request.clientIp,
      requestId: request.requestId,
      body: pathname === "/api/health" ? undefined : await parseBody(request),
    },
    createResponse(response),
  );
  return true;
}
