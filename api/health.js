import { getPublicHealth } from "./services/health-service.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const health = await getPublicHealth();
  return response.status(health.status).json(health.body);
}
