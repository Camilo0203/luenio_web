import crypto from "node:crypto";
import { getSecurityConfig } from "../config/env.js";
import { getDetailedHealth, getPublicHealth } from "./services/health-service.js";

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length > 0 &&
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function hasHealthcheckAccess(request) {
  const authorization = String(request.headers?.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return timingSafeEqual(token, getSecurityConfig().healthcheckToken);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const wantsDetails = request.query?.details === "1";
  if (wantsDetails && !hasHealthcheckAccess(request)) {
    return response.status(401).json({ ok: false, error: "Authentication required." });
  }

  const health = wantsDetails ? await getDetailedHealth() : await getPublicHealth();
  return response.status(health.status).json(health.body);
}
