import crypto from "node:crypto";
import { isValidPlan } from "../../config/billing.js";
import { getSecurityConfig } from "../../config/env.js";
import { getSupabaseConfig, readLocalState, supabaseRequest, writeLocalState } from "../../db/storage.js";
import { generateRecordId } from "../../core/ids.js";

const SESSION_COOKIE = "luenio_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_PLAN = "starter";
const authFieldLimits = {
  email: 254,
  password: 256,
  businessName: 120,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeAuthText(value, limit) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeEmail(email) {
  return normalizeAuthText(email, authFieldLimits.email).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordInput(password) {
  const rawPassword = String(password || "");
  if (rawPassword.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (rawPassword.length > authFieldLimits.password) throw new Error("Password is too long.");
  return rawPassword;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getAuthSecret() {
  const security = getSecurityConfig();
  const secret = security.authSecret;
  if (secret) return secret;
  if (security.nodeEnv === "production" || security.requireSupabase) {
    throw new Error("AUTH_SECRET is required for production sessions.");
  }
  return "luenio-local-development-secret-change-me";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function timingSafeEqualString(left, right, encoding = "utf8") {
  try {
    const leftBuffer = Buffer.from(String(left || ""), encoding);
    const rightBuffer = Buffer.from(String(right || ""), encoding);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || "").split(":");
  if (!salt || !storedHash) return false;
  const nextHash = hashPassword(password, salt).split(":")[1];
  return timingSafeEqualString(storedHash, nextHash, "hex");
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    businessName: user.businessName || user.business_name,
    plan: user.plan || DEFAULT_PLAN,
    createdAt: user.createdAt || user.created_at,
  };
}

function normalizeUserFromSupabase(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    businessName: user.business_name,
    plan: user.plan || DEFAULT_PLAN,
    passwordHash: user.password_hash,
    createdAt: user.created_at,
  };
}

function mapUserForSupabase(user) {
  return {
    id: user.id,
    email: user.email,
    business_name: user.businessName,
    plan: user.plan,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function getCookie(request, name) {
  const rawCookie = request.headers?.cookie || request.headers?.Cookie || "";
  return rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function sessionCookieAttributes() {
  const secure = getSecurityConfig().cookieSecure;
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function createSessionToken(user) {
  const payload = {
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const tokenParts = String(token).split(".");
  if (tokenParts.length !== 2) return null;
  const [encodedPayload, signature] = tokenParts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  if (!timingSafeEqualString(signature, expectedSignature)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; ${sessionCookieAttributes()}; Max-Age=${SESSION_TTL_SECONDS}`
  );
}

export function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${sessionCookieAttributes()}; Max-Age=0`);
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  if (getSupabaseConfig()) {
    const [user] = await supabaseRequest(`users?email=eq.${encodeURIComponent(normalizedEmail)}&select=*&limit=1`);
    return normalizeUserFromSupabase(user);
  }

  const database = readLocalState();
  return (database.users || []).find((user) => user.email === normalizedEmail) || null;
}

export async function findUserById(userId) {
  if (!userId) return null;

  if (getSupabaseConfig()) {
    const [user] = await supabaseRequest(`users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
    return normalizeUserFromSupabase(user);
  }

  const database = readLocalState();
  return (database.users || []).find((user) => user.id === userId) || null;
}

export async function createUser({ email, password, businessName, plan = DEFAULT_PLAN }) {
  const rawEmail = String(email || "").trim();
  const rawBusinessName = String(businessName || "").trim();
  if (rawEmail.length > authFieldLimits.email) throw new Error("Email is too long.");
  if (rawBusinessName.length > authFieldLimits.businessName) throw new Error("Business name is too long.");

  const normalizedEmail = normalizeEmail(email);
  const normalizedBusinessName = normalizeAuthText(businessName, authFieldLimits.businessName);
  const normalizedPlan = String(plan || DEFAULT_PLAN).trim();
  const normalizedPassword = validatePasswordInput(password);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) throw new Error("A valid email is required.");
  if (normalizedBusinessName.length < 2) throw new Error("Business name is required.");
  if (!isValidPlan(normalizedPlan)) throw new Error("Unknown plan.");
  if (await findUserByEmail(normalizedEmail)) throw new Error("A user with this email already exists.");

  const user = {
    id: generateRecordId("user"),
    email: normalizedEmail,
    businessName: normalizedBusinessName,
    plan: normalizedPlan,
    passwordHash: hashPassword(normalizedPassword),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (getSupabaseConfig()) {
    await supabaseRequest("users", {
      method: "POST",
      body: JSON.stringify(mapUserForSupabase(user)),
    });
  } else {
    const database = readLocalState();
    writeLocalState({ ...database, users: [user, ...(database.users || [])] });
  }

  return sanitizeUser(user);
}

export async function authenticateUser({ email, password }) {
  const normalizedPassword = validatePasswordInput(password);
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(normalizedPassword, user.passwordHash || user.password_hash)) {
    throw new Error("Invalid email or password.");
  }
  return sanitizeUser(user);
}

export async function getSessionUser(request) {
  const token = getCookie(request, SESSION_COOKIE);
  const payload = verifySessionToken(token);
  if (!payload?.sub) return null;
  return sanitizeUser(await findUserById(payload.sub));
}

export async function requireUser(request) {
  const user = await getSessionUser(request);
  if (!user) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  return user;
}
