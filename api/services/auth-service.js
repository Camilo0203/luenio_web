import crypto from "node:crypto";
import { promisify } from "node:util";
import { isValidPlan } from "../../config/billing.js";
import { getSecurityConfig } from "../../config/env.js";
import {
  getSupabaseConfig,
  readLocalState,
  supabaseRequest,
  writeLocalState,
} from "../../db/storage.js";
import { generateRecordId } from "../../core/ids.js";

const pbkdf2 = promisify(crypto.pbkdf2);
const DEVELOPMENT_SESSION_COOKIE = "luenio_session";
const PRODUCTION_SESSION_COOKIE = "__Host-luenio_session";
/** Non-secret UI hint only (readable by JS). Real auth stays on HttpOnly session cookie. */
const UI_SIGNED_IN_HINT = "luenio_signed_in";
const TRUSTED_DEVICE_COOKIE = "luenio_trusted_device";
const TRUSTED_DEVICE_DAYS = 30;
const DEFAULT_PLAN = "starter";
const PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 600_000;
const LEGACY_PASSWORD_HASH_ITERATIONS = 120_000;
const MAX_ACTIVE_SESSIONS = 10;
const MAX_PASSWORD_HASH_CONCURRENCY = 2;
const MAX_PASSWORD_HASH_QUEUE = 12;
const DUMMY_PASSWORD_HASH = `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$bHVlbmlvLWR1bW15LXNhbHQ$${"0".repeat(64)}`;
const authFieldLimits = {
  email: 254,
  password: 128,
  businessName: 120,
};
let activePasswordHashes = 0;
const passwordHashWaiters = [];

function nowIso() {
  return new Date().toISOString();
}

function normalizeAuthText(value, limit) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function normalizeEmail(email) {
  return normalizeAuthText(email, authFieldLimits.email).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordMinimumLength() {
  return Math.max(12, Math.min(64, getSecurityConfig().passwordMinLength));
}

export function validatePasswordInput(password) {
  const rawPassword = String(password || "");
  if (rawPassword.length < getPasswordMinimumLength()) {
    throw new Error(`Password must contain at least ${getPasswordMinimumLength()} characters.`);
  }
  if (rawPassword.length > authFieldLimits.password) throw new Error("Password is too long.");
  return rawPassword;
}

function getAuthSecret() {
  const security = getSecurityConfig();
  const secret = security.authSecret;
  if (secret) return secret;
  if (security.nodeEnv === "production" || security.requireSupabase) {
    throw new Error("AUTH_SECRET is required for production authentication.");
  }
  return "luenio-local-development-secret-change-me";
}

function getSessionTtlSeconds() {
  return Math.max(900, Math.min(7 * 24 * 60 * 60, getSecurityConfig().sessionTtlSeconds));
}

function timingSafeEqualString(left, right, encoding = "utf8") {
  try {
    const leftBuffer = Buffer.from(String(left || ""), encoding);
    const rightBuffer = Buffer.from(String(right || ""), encoding);
    if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function hashOpaqueValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function hashPrivateMetadata(label, value) {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${label}:${String(value || "unknown")}`)
    .digest("hex");
}

async function acquirePasswordHashSlot() {
  if (activePasswordHashes < MAX_PASSWORD_HASH_CONCURRENCY) {
    activePasswordHashes += 1;
    return;
  }
  if (passwordHashWaiters.length >= MAX_PASSWORD_HASH_QUEUE) {
    const error = new Error("Authentication service is temporarily busy.");
    error.statusCode = 503;
    error.publicMessage = "Authentication service is temporarily busy.";
    throw error;
  }
  await new Promise((resolve) => passwordHashWaiters.push(resolve));
}

function releasePasswordHashSlot() {
  const next = passwordHashWaiters.shift();
  if (next) {
    next();
    return;
  }
  activePasswordHashes = Math.max(0, activePasswordHashes - 1);
}

async function derivePassword(password, salt, iterations) {
  await acquirePasswordHashSlot();
  try {
    const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
    return hash.toString("hex");
  } finally {
    releasePasswordHashSlot();
  }
}

export async function createPasswordHash(password) {
  const normalizedPassword = validatePasswordInput(password);
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await derivePassword(normalizedPassword, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

function parsePasswordHash(passwordHash) {
  const value = String(passwordHash || "");
  const modern = value.split("$");
  if (modern.length === 4 && modern[0] === PASSWORD_HASH_ALGORITHM) {
    const iterations = Number(modern[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
      return null;
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(modern[2]) || !/^[a-f0-9]{64}$/i.test(modern[3])) {
      return null;
    }
    return { salt: modern[2], iterations, hash: modern[3], legacy: false };
  }

  const legacy = value.split(":");
  if (
    legacy.length === 2 &&
    /^[a-f0-9]{16,128}$/i.test(legacy[0]) &&
    /^[a-f0-9]{64}$/i.test(legacy[1])
  ) {
    return {
      salt: legacy[0],
      iterations: LEGACY_PASSWORD_HASH_ITERATIONS,
      hash: legacy[1],
      legacy: true,
    };
  }
  return null;
}

async function verifyPassword(password, passwordHash) {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return { valid: false, needsUpgrade: false };
  const nextHash = await derivePassword(password, parsed.salt, parsed.iterations);
  return {
    valid: timingSafeEqualString(parsed.hash, nextHash, "hex"),
    needsUpgrade: parsed.legacy || parsed.iterations < PASSWORD_HASH_ITERATIONS,
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    businessName: user.businessName || user.business_name,
    plan: user.plan || DEFAULT_PLAN,
    role: user.role || "client",
    businessId: user.businessId || user.business_id || user.id,
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
    role: user.role || "client",
    businessId: user.business_id || user.id,
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
    role: user.role || "client",
    business_id: user.businessId || user.id,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function getCookie(request, name) {
  const rawCookie = request.headers?.cookie || request.headers?.Cookie || "";
  const match = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1) || "";
}

function getRequestSessionToken(request) {
  return (
    getCookie(request, PRODUCTION_SESSION_COOKIE) || getCookie(request, DEVELOPMENT_SESSION_COOKIE)
  );
}

function sessionCookieAttributes() {
  const secure = getSecurityConfig().cookieSecure;
  return ["Path=/", "HttpOnly", "SameSite=Strict", secure ? "Secure" : "", "Priority=High"]
    .filter(Boolean)
    .join("; ");
}

function sessionCookieName() {
  return getSecurityConfig().cookieSecure ? PRODUCTION_SESSION_COOKIE : DEVELOPMENT_SESSION_COOKIE;
}

function parseSessionToken(token) {
  const value = String(token || "");
  if (value.length > 256) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [id, secret] = parts;
  if (!/^[A-Za-z0-9_-]{12,180}$/.test(id) || !/^[A-Za-z0-9_-]{43,128}$/.test(secret)) {
    return null;
  }
  return { id, secret };
}

async function findSessionById(sessionId) {
  if (getSupabaseConfig()) {
    const [record] = await supabaseRequest(
      `sessions?id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`,
    );
    return record || null;
  }
  return (readLocalState().sessions || []).find((session) => session.id === sessionId) || null;
}

async function persistSession(record) {
  if (getSupabaseConfig()) {
    await supabaseRequest("sessions", {
      method: "POST",
      body: JSON.stringify({
        id: record.id,
        user_id: record.userId,
        token_hash: record.tokenHash,
        ip_hash: record.ipHash,
        user_agent_hash: record.userAgentHash,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
        last_seen_at: record.createdAt,
      }),
    });

    const activeSessions = await supabaseRequest(
      `sessions?user_id=eq.${encodeURIComponent(record.userId)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(record.createdAt)}&select=id&order=created_at.desc`,
    );
    const oldSessions = activeSessions.slice(MAX_ACTIVE_SESSIONS);
    for (const session of oldSessions) {
      await supabaseRequest(`sessions?id=eq.${encodeURIComponent(session.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: record.createdAt }),
      });
    }
    return;
  }

  const database = readLocalState();
  const active = (database.sessions || [])
    .filter(
      (session) =>
        session.userId === record.userId &&
        !session.revokedAt &&
        new Date(session.expiresAt).getTime() > Date.now(),
    )
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, MAX_ACTIVE_SESSIONS - 1);
  const unrelated = (database.sessions || []).filter(
    (session) =>
      session.userId !== record.userId && new Date(session.expiresAt).getTime() > Date.now(),
  );
  writeLocalState({ ...database, sessions: [record, ...active, ...unrelated] });
}

export async function createSessionToken(user, context = {}) {
  if (!user?.id) throw new Error("A valid user is required to create a session.");
  const secret = crypto.randomBytes(32).toString("base64url");
  const createdAt = nowIso();
  const record = {
    id: generateRecordId("session"),
    userId: user.id,
    tokenHash: hashOpaqueValue(secret),
    ipHash: hashPrivateMetadata("ip", context.clientIp),
    userAgentHash: hashPrivateMetadata("ua", context.userAgent),
    expiresAt: new Date(Date.now() + getSessionTtlSeconds() * 1_000).toISOString(),
    createdAt,
  };
  await persistSession(record);
  return `${record.id}.${secret}`;
}

export async function verifySessionToken(token, context = {}) {
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  const session = await findSessionById(parsed.id);
  if (!session) return null;
  const tokenHash = session.tokenHash || session.token_hash;
  const revokedAt = session.revokedAt || session.revoked_at;
  const expiresAt = session.expiresAt || session.expires_at;
  const userId = session.userId || session.user_id;
  const storedUserAgentHash = session.userAgentHash || session.user_agent_hash;
  if (revokedAt || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
  if (!timingSafeEqualString(tokenHash, hashOpaqueValue(parsed.secret), "hex")) return null;
  if (
    context.userAgent &&
    storedUserAgentHash &&
    !timingSafeEqualString(storedUserAgentHash, hashPrivateMetadata("ua", context.userAgent), "hex")
  ) {
    return null;
  }
  return {
    sub: userId,
    sid: session.id,
    exp: Math.floor(new Date(expiresAt).getTime() / 1_000),
  };
}

function uiSignedInHintAttributes() {
  const secure = getSecurityConfig().cookieSecure;
  // Intentionally NOT HttpOnly — only used to avoid label FOUC on the marketing site.
  return ["Path=/", "SameSite=Strict", secure ? "Secure" : ""].filter(Boolean).join("; ");
}

export function setSessionCookie(response, token) {
  const ttl = getSessionTtlSeconds();
  response.setHeader("Set-Cookie", [
    `${sessionCookieName()}=${token}; ${sessionCookieAttributes()}; Max-Age=${ttl}`,
    `${UI_SIGNED_IN_HINT}=1; ${uiSignedInHintAttributes()}; Max-Age=${ttl}`,
  ]);
}

export function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", [
    ...[PRODUCTION_SESSION_COOKIE, DEVELOPMENT_SESSION_COOKIE].map(
      (name) => `${name}=; ${sessionCookieAttributes()}; Max-Age=0`,
    ),
    `${UI_SIGNED_IN_HINT}=; ${uiSignedInHintAttributes()}; Max-Age=0`,
  ]);
}

export async function revokeSessionToken(token) {
  const parsed = parseSessionToken(token);
  if (!parsed) return;
  const session = await findSessionById(parsed.id);
  if (!session) return;
  const tokenHash = session.tokenHash || session.token_hash;
  if (!timingSafeEqualString(tokenHash, hashOpaqueValue(parsed.secret), "hex")) return;
  const revokedAt = nowIso();
  if (getSupabaseConfig()) {
    await supabaseRequest(`sessions?id=eq.${encodeURIComponent(parsed.id)}&revoked_at=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: revokedAt }),
    });
    return;
  }
  const database = readLocalState();
  writeLocalState({
    ...database,
    sessions: (database.sessions || []).map((item) =>
      item.id === parsed.id ? { ...item, revokedAt } : item,
    ),
  });
}

export async function revokeRequestSession(request) {
  await revokeSessionToken(getRequestSessionToken(request));
}

export async function revokeAllUserSessions(userId) {
  if (!userId) return;
  const revokedAt = nowIso();
  if (getSupabaseConfig()) {
    await supabaseRequest(`sessions?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: revokedAt }),
    });
    return;
  }
  const database = readLocalState();
  writeLocalState({
    ...database,
    sessions: (database.sessions || []).map((session) =>
      session.userId === userId && !session.revokedAt ? { ...session, revokedAt } : session,
    ),
  });
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  if (getSupabaseConfig()) {
    const [user] = await supabaseRequest(
      `users?email=eq.${encodeURIComponent(normalizedEmail)}&select=*&limit=1`,
    );
    return normalizeUserFromSupabase(user);
  }

  const database = readLocalState();
  return (database.users || []).find((user) => user.email === normalizedEmail) || null;
}

export async function findUserById(userId) {
  if (!userId) return null;

  if (getSupabaseConfig()) {
    const [user] = await supabaseRequest(
      `users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    );
    return normalizeUserFromSupabase(user);
  }

  const database = readLocalState();
  return (database.users || []).find((user) => user.id === userId) || null;
}

export async function createUser({
  email,
  password,
  businessName,
  plan = DEFAULT_PLAN,
  role = "client",
  businessId,
}) {
  const rawEmail = String(email || "").trim();
  const rawBusinessName = String(businessName || "").trim();
  if (rawEmail.length > authFieldLimits.email) throw new Error("Email is too long.");
  if (rawBusinessName.length > authFieldLimits.businessName)
    throw new Error("Business name is too long.");

  const normalizedEmail = normalizeEmail(email);
  const normalizedBusinessName = normalizeAuthText(businessName, authFieldLimits.businessName);
  const normalizedPlan = String(plan || DEFAULT_PLAN).trim();

  if (!normalizedEmail || !isValidEmail(normalizedEmail))
    throw new Error("A valid email is required.");
  if (normalizedBusinessName.length < 2) throw new Error("Business name is required.");
  if (!isValidPlan(normalizedPlan)) throw new Error("Unknown plan.");
  if (await findUserByEmail(normalizedEmail))
    throw new Error("A user with this email already exists.");

  const timestamp = nowIso();
  const user = {
    id: generateRecordId("user"),
    email: normalizedEmail,
    businessName: normalizedBusinessName,
    plan: normalizedPlan,
    role: role === "admin" ? "admin" : "client",
    businessId: businessId || undefined,
    passwordHash: await createPasswordHash(password),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  user.businessId ||= user.id;

  if (getSupabaseConfig()) {
    await supabaseRequest("businesses?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        id: user.businessId,
        name: user.businessName,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    });
    await supabaseRequest("users", {
      method: "POST",
      body: JSON.stringify(mapUserForSupabase(user)),
    });
  } else {
    const database = readLocalState();
    const businesses = (database.businesses || []).some(
      (business) => business.id === user.businessId,
    )
      ? database.businesses
      : [
          {
            id: user.businessId,
            name: user.businessName,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...(database.businesses || []),
        ];
    writeLocalState({
      ...database,
      businesses,
      users: [user, ...(database.users || [])],
    });
  }

  return sanitizeUser(user);
}

function throttleKey(label, value) {
  return hashPrivateMetadata(`auth-throttle-${label}`, String(value || "unknown").toLowerCase());
}

function getThrottleKeys(email, clientIp) {
  const normalizedIp = String(clientIp || "unknown").toLowerCase();
  return [
    throttleKey("identity-ip", `${normalizeEmail(email)}|${normalizedIp}`),
    throttleKey("ip", normalizedIp),
  ];
}

async function getThrottleRecord(keyHash) {
  if (getSupabaseConfig()) {
    const [record] = await supabaseRequest(
      `auth_throttles?key_hash=eq.${encodeURIComponent(keyHash)}&select=*&limit=1`,
    );
    return record || null;
  }
  return (readLocalState().authThrottles || []).find((item) => item.keyHash === keyHash) || null;
}

async function assertAuthenticationAllowed(keys) {
  const records = await Promise.all(keys.map(getThrottleRecord));
  const now = Date.now();
  let latestBlockedMs = 0;
  for (const record of records) {
    const blockedUntil = record?.blockedUntil || record?.blocked_until;
    if (!blockedUntil) continue;
    const until = new Date(blockedUntil).getTime();
    if (until > now && until > latestBlockedMs) latestBlockedMs = until;
  }
  if (!latestBlockedMs) return;
  const retryAfterSeconds = Math.max(1, Math.ceil((latestBlockedMs - now) / 1000));
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const error = new Error(`Demasiados intentos. Espera ${minutes} min e inténtalo de nuevo.`);
  error.statusCode = 429;
  error.retryAfterSeconds = retryAfterSeconds;
  error.code = "AUTH_LOCKED";
  throw error;
}

async function registerAuthenticationFailure(keys) {
  const security = getSecurityConfig();
  const now = nowIso();
  if (getSupabaseConfig()) {
    for (const keyHash of keys) {
      await supabaseRequest("rpc/luenio_register_auth_failure", {
        method: "POST",
        body: JSON.stringify({
          p_key_hash: keyHash,
          p_now: now,
          p_window_seconds: Math.max(60, security.authFailureWindowSeconds),
          p_max_failures: Math.max(3, security.authMaxFailures),
          p_lockout_seconds: Math.max(60, security.authLockoutSeconds),
        }),
      });
    }
    return;
  }

  const database = readLocalState();
  const records = [...(database.authThrottles || [])];
  const nowTime = Date.now();
  for (const keyHash of keys) {
    const index = records.findIndex((item) => item.keyHash === keyHash);
    const current = index >= 0 ? records[index] : null;
    const windowStart = current ? new Date(current.windowStartedAt).getTime() : 0;
    const inWindow = nowTime - windowStart < security.authFailureWindowSeconds * 1_000;
    const failures = (inWindow ? current.failures : 0) + 1;
    const next = {
      keyHash,
      failures,
      windowStartedAt: inWindow ? current.windowStartedAt : now,
      blockedUntil:
        failures >= security.authMaxFailures
          ? new Date(nowTime + security.authLockoutSeconds * 1_000).toISOString()
          : null,
      updatedAt: now,
    };
    if (index >= 0) records[index] = next;
    else records.push(next);
  }
  writeLocalState({ ...database, authThrottles: records.slice(-10_000) });
}

async function clearAuthenticationFailures(keys) {
  if (getSupabaseConfig()) {
    for (const keyHash of keys) {
      await supabaseRequest(`auth_throttles?key_hash=eq.${encodeURIComponent(keyHash)}`, {
        method: "DELETE",
      });
    }
    return;
  }
  const database = readLocalState();
  const keySet = new Set(keys);
  writeLocalState({
    ...database,
    authThrottles: (database.authThrottles || []).filter((item) => !keySet.has(item.keyHash)),
  });
}

async function replacePasswordHash(userId, passwordHash, { revokeSessions = false } = {}) {
  const updatedAt = nowIso();
  if (getSupabaseConfig()) {
    await supabaseRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: passwordHash, updated_at: updatedAt }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({
      ...database,
      users: (database.users || []).map((user) =>
        user.id === userId ? { ...user, passwordHash, updatedAt } : user,
      ),
    });
  }
  if (revokeSessions) await revokeAllUserSessions(userId);
}

export async function authenticateUser({ email, password, clientIp }) {
  const rawPassword = String(password || "");
  const keys = getThrottleKeys(email, clientIp);
  await assertAuthenticationAllowed(keys);
  const user = await findUserByEmail(email);
  const hashToVerify = user?.passwordHash || user?.password_hash || DUMMY_PASSWORD_HASH;
  const passwordInRange = rawPassword.length > 0 && rawPassword.length <= authFieldLimits.password;
  const result = await verifyPassword(
    passwordInRange ? rawPassword : "invalid-password",
    hashToVerify,
  );

  if (!user || !passwordInRange || !result.valid) {
    await registerAuthenticationFailure(keys);
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  await clearAuthenticationFailures(keys);
  if (result.needsUpgrade) {
    await replacePasswordHash(user.id, await createPasswordHash(rawPassword));
  }
  return sanitizeUser(user);
}

export async function updateUserPassword(userId, password) {
  await replacePasswordHash(userId, await createPasswordHash(password), { revokeSessions: true });
}

export async function getSessionUser(request) {
  const payload = await verifySessionToken(getRequestSessionToken(request), {
    userAgent: request.headers?.["user-agent"],
  });
  if (!payload?.sub) return null;
  return sanitizeUser(await findUserById(payload.sub));
}

/** Session payload + user for account security UI. */
export async function getSessionContext(request) {
  const payload = await verifySessionToken(getRequestSessionToken(request), {
    userAgent: request.headers?.["user-agent"],
  });
  if (!payload?.sub) return null;
  const user = sanitizeUser(await findUserById(payload.sub));
  if (!user) return null;
  return { user, sessionId: payload.sid, exp: payload.exp };
}

export async function listUserSessions(userId, currentSessionId = null) {
  if (!userId) return [];
  const now = Date.now();
  let rows = [];
  if (getSupabaseConfig()) {
    rows = await supabaseRequest(
      `sessions?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(nowIso())}&select=id,created_at,expires_at,last_seen_at&order=created_at.desc`,
    );
  } else {
    rows = (readLocalState().sessions || []).filter(
      (s) =>
        s.userId === userId && !s.revokedAt && s.expiresAt && new Date(s.expiresAt).getTime() > now,
    );
  }

  return rows.map((s) => {
    const id = s.id;
    const createdAt = s.createdAt || s.created_at;
    const expiresAt = s.expiresAt || s.expires_at;
    const lastSeenAt = s.lastSeenAt || s.last_seen_at || createdAt;
    return {
      id,
      createdAt,
      expiresAt,
      lastSeenAt,
      current: Boolean(currentSessionId && id === currentSessionId),
    };
  });
}

export async function revokeUserSession(userId, sessionId) {
  if (!userId || !sessionId) return false;
  const session = await findSessionById(sessionId);
  if (!session) return false;
  const owner = session.userId || session.user_id;
  if (owner !== userId) return false;
  const revokedAt = nowIso();
  if (getSupabaseConfig()) {
    await supabaseRequest(
      `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`,
      {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: revokedAt }),
      },
    );
    return true;
  }
  const database = readLocalState();
  writeLocalState({
    ...database,
    sessions: (database.sessions || []).map((item) =>
      item.id === sessionId && item.userId === userId ? { ...item, revokedAt } : item,
    ),
  });
  return true;
}

export async function revokeOtherUserSessions(userId, keepSessionId) {
  if (!userId) return 0;
  const sessions = await listUserSessions(userId, keepSessionId);
  let count = 0;
  for (const s of sessions) {
    if (s.current) continue;
    const ok = await revokeUserSession(userId, s.id);
    if (ok) count += 1;
  }
  return count;
}

function trustedDeviceSecret() {
  return getSecurityConfig().authSecret || "luenio-local-development-secret-change-me";
}

function signTrustedDevice(body) {
  return crypto.createHmac("sha256", trustedDeviceSecret()).update(body).digest("base64url");
}

export function createTrustedDeviceToken(userId) {
  const exp = Math.floor(Date.now() / 1000) + TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  const body = `${userId}.${exp}`;
  return `${body}.${signTrustedDevice(body)}`;
}

export function verifyTrustedDeviceToken(token, userId) {
  const value = String(token || "");
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [uid, expRaw, sig] = parts;
  if (uid !== userId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false;
  const body = `${uid}.${expRaw}`;
  const expected = signTrustedDevice(body);
  return timingSafeEqualString(sig, expected);
}

function trustedDeviceCookieAttributes() {
  const secure = getSecurityConfig().cookieSecure;
  return ["Path=/", "HttpOnly", "SameSite=Strict", secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");
}

export function getTrustedDeviceToken(request) {
  return getCookie(request, TRUSTED_DEVICE_COOKIE);
}

export function setTrustedDeviceCookie(response, userId) {
  const token = createTrustedDeviceToken(userId);
  const maxAge = TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  const existing = response.getHeader?.("Set-Cookie");
  const next = `${TRUSTED_DEVICE_COOKIE}=${token}; ${trustedDeviceCookieAttributes()}; Max-Age=${maxAge}`;
  if (!existing) {
    response.setHeader("Set-Cookie", next);
  } else if (Array.isArray(existing)) {
    response.setHeader("Set-Cookie", [...existing, next]);
  } else {
    response.setHeader("Set-Cookie", [String(existing), next]);
  }
}

export function clearTrustedDeviceCookie(response) {
  const clear = `${TRUSTED_DEVICE_COOKIE}=; ${trustedDeviceCookieAttributes()}; Max-Age=0`;
  const existing = response.getHeader?.("Set-Cookie");
  if (!existing) {
    response.setHeader("Set-Cookie", clear);
  } else if (Array.isArray(existing)) {
    response.setHeader("Set-Cookie", [...existing, clear]);
  } else {
    response.setHeader("Set-Cookie", [String(existing), clear]);
  }
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
