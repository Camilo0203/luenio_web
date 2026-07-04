import authHandler from "./auth.js";
import billingHandler from "./billing.js";
import contactHandler from "./contact.js";
import healthHandler from "./health.js";
import leadsHandler from "./leads.js";
import processHandler from "./process.js";
import settingsHandler from "./settings.js";
import stripeWebhookHandler from "./stripe-webhook.js";

const apiHandlers = {
  "/api/auth": authHandler,
  "/api/billing": billingHandler,
  "/api/contact": contactHandler,
  "/api/health": healthHandler,
  "/api/leads": leadsHandler,
  "/api/process": processHandler,
  "/api/settings": settingsHandler,
};

export function isApiRoute(pathname) {
  return pathname === "/api/stripe-webhook" || Boolean(apiHandlers[pathname]);
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
      body: pathname === "/api/health" ? undefined : await parseBody(request),
    },
    createResponse(response),
  );
  return true;
}
