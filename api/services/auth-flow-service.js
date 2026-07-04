import { getStorageMode } from "../../db/storage.js";
import {
  authenticateUser,
  createSessionToken,
  createUser,
  getSessionUser,
} from "./auth-service.js";

function withStorage(payload) {
  return { ...payload, storage: getStorageMode() };
}

export function getAuthErrorStatus(error) {
  if (error.statusCode) return error.statusCode;
  const message = String(error.message || "");
  if (message.includes("AUTH_SECRET")) return 500;
  if (message.includes("Invalid")) return 401;
  return 400;
}

export async function getAuthSession(request) {
  const user = await getSessionUser(request);
  return {
    status: 200,
    body: withStorage({ ok: true, user, authenticated: Boolean(user) }),
  };
}

export async function registerAuthSession(body = {}) {
  const user = await createUser({
    email: body.email,
    password: body.password,
    businessName: body.businessName,
    plan: body.plan,
  });

  return {
    status: 201,
    body: withStorage({ ok: true, user, authenticated: true }),
    sessionToken: createSessionToken(user),
  };
}

export async function loginAuthSession(body = {}) {
  const user = await authenticateUser({ email: body.email, password: body.password });
  return {
    status: 200,
    body: withStorage({ ok: true, user, authenticated: true }),
    sessionToken: createSessionToken(user),
  };
}

export function logoutAuthSession() {
  return {
    status: 200,
    body: { ok: true, authenticated: false },
    clearSession: true,
  };
}
