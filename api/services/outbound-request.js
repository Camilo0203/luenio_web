import net from "node:net";
import { isProduction } from "../../config/env.js";

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  return false;
}

export function getSecureOutboundUrl(value, label = "Webhook URL") {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 503;
    throw error;
  }

  if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) {
    const error = new Error(`${label} uses an unsupported URL.`);
    error.statusCode = 503;
    throw error;
  }

  if (isProduction()) {
    if (url.protocol !== "https:") {
      const error = new Error(`${label} must use HTTPS in production.`);
      error.statusCode = 503;
      throw error;
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIp(hostname)) {
      const error = new Error(`${label} cannot target a private address in production.`);
      error.statusCode = 503;
      throw error;
    }
  }
  return url.toString();
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
