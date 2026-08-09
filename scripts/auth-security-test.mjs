import {
  authenticateUser,
  createSessionToken,
  createUser,
  updateUserPassword,
  verifySessionToken,
} from "../api/services/auth-service.js";
import { readLocalState, writeLocalState } from "../db/storage.js";
import {
  acceptInvitation,
  createInvitation,
  revokeInvitation,
} from "../api/services/invitation-service.js";
import fs from "node:fs";
import path from "node:path";
import {
  getLoginGuardChallenge,
  loginAuthSession,
  verifyMfaAuthSession,
} from "../api/services/auth-flow-service.js";
import invitationsHandler from "../api/invitations.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejectsWith(operation, expectedMessage, label) {
  try {
    await operation();
  } catch (error) {
    assert(
      error.message === expectedMessage,
      `${label} must fail with "${expectedMessage}", got "${error.message}".`,
    );
    return;
  }
  throw new Error(`${label} must reject.`);
}

const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;
const originalDatabase = readLocalState();
const previousAdminEmails = process.env.ADMIN_EMAILS;
const previousAdminMfaRequired = process.env.ADMIN_MFA_REQUIRED;
const previousMfaWebhookUrl = process.env.AUTH_MFA_WEBHOOK_URL;
const previousMfaWebhookToken = process.env.AUTH_MFA_WEBHOOK_TOKEN;
const previousFetch = globalThis.fetch;

try {
  assert(
    (await verifySessionToken("not-a-session-token")) === null,
    "Malformed session token must fail closed.",
  );
  assert(
    (await verifySessionToken("payload.short")) === null,
    "Wrong-length session signatures must fail closed.",
  );
  assert(
    (await verifySessionToken("payload.signature.extra")) === null,
    "Session tokens with extra segments must fail closed.",
  );
  assert(
    (await verifySessionToken(".signature")) === null,
    "Session tokens with empty payloads must fail closed.",
  );
  assert(
    (await verifySessionToken("payload.")) === null,
    "Session tokens with empty signatures must fail closed.",
  );
  assert(
    (await verifySessionToken("%%%." + "x".repeat(43))) === null,
    "Malformed session payloads must fail closed.",
  );

  const createdUser = await createUser({
    email: `id-format-${Date.now()}@luenio.test`,
    password: "super-secret-123",
    businessName: "ID Format Workspace",
    plan: "starter",
  });
  assert(
    /^user_\d+_[a-f0-9]{32}$/.test(createdUser.id),
    "Created user ids must use the shared secure id format.",
  );
  const storedUser = (readLocalState().users || []).find((user) => user.id === createdUser.id);
  assert(
    storedUser?.passwordHash?.startsWith("pbkdf2-sha256$600000$"),
    "Passwords must use versioned PBKDF2-HMAC-SHA256 with 600,000 iterations.",
  );
  const token = await createSessionToken(createdUser, {
    clientIp: "127.0.0.1",
    userAgent: "luenio-auth-test",
  });
  const payload = await verifySessionToken(token);
  assert(payload?.sub === createdUser.id, "Stored session must resolve to the stable user id.");
  assert(payload?.sid, "Stored session must include a revocable session id.");
  assert(payload?.exp, "Stored session must include an expiration timestamp.");
  assert(
    !token.includes(createdUser.email),
    "Opaque session tokens must not include user email PII.",
  );
  assert(
    !(readLocalState().sessions || []).some((session) => session.tokenHash === token),
    "Persistent sessions must store only a token hash, never the bearer token.",
  );
  const [sessionId, sessionSecret] = token.split(".");
  const replacement = sessionSecret.endsWith("A") ? "B" : "A";
  const tamperedToken = `${sessionId}.${sessionSecret.slice(0, -1)}${replacement}`;
  assert(
    (await verifySessionToken(tamperedToken)) === null,
    "Tampered session token must fail closed.",
  );
  await updateUserPassword(createdUser.id, "replacement-secret-123");
  assert(
    (await verifySessionToken(token)) === null,
    "Changing a password must revoke every existing session.",
  );

  const lockoutUser = await createUser({
    email: `lockout-${Date.now()}@luenio.test`,
    password: "lockout-secret-123",
    businessName: "Lockout Isolation Workspace",
  });
  const lockoutRunId = Date.now();
  const blockedSourceIp = `198.18.${Math.floor(lockoutRunId / 254) % 254}.${lockoutRunId % 254}`;
  const isolatedSourceIp = `198.19.${Math.floor(lockoutRunId / 254) % 254}.${lockoutRunId % 254}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assertRejectsWith(
      () =>
        authenticateUser({
          email: lockoutUser.email,
          password: "wrong-password-123",
          clientIp: blockedSourceIp,
        }),
      "Invalid email or password.",
      `Failed login ${attempt + 1}`,
    );
  }
  await assertRejectsWith(
    () =>
      authenticateUser({
        email: lockoutUser.email,
        password: "lockout-secret-123",
        clientIp: blockedSourceIp,
      }),
    "Demasiados intentos. Espera 15 min e inténtalo de nuevo.",
    "Blocked source IP",
  );
  const isolatedLogin = await authenticateUser({
    email: lockoutUser.email,
    password: "lockout-secret-123",
    clientIp: isolatedSourceIp,
  });
  assert(
    isolatedLogin.id === lockoutUser.id,
    "Failures from one IP must not globally lock the victim account from another IP.",
  );

  const adminEmail = `admin-${Date.now()}@luenio.test`;
  process.env.ADMIN_EMAILS = adminEmail;
  const admin = await createUser({
    email: adminEmail,
    password: "super-secret-123",
    businessName: "Luenio Admin",
    role: "admin",
  });
  process.env.ADMIN_MFA_REQUIRED = "true";
  process.env.AUTH_MFA_WEBHOOK_URL = "https://automation.luenio.test/webhook/mfa";
  process.env.AUTH_MFA_WEBHOOK_TOKEN = "mfa-test-token-at-least-32-characters";
  let deliveredMfaCode = "";
  globalThis.fetch = async (_url, options) => {
    deliveredMfaCode = JSON.parse(options.body).code;
    return { ok: true, status: 200 };
  };
  const mfaRequestContext = {
    clientIp: "127.0.0.1",
    headers: { "user-agent": "luenio-auth-test" },
  };
  const loginGuard = getLoginGuardChallenge(mfaRequestContext).body;
  const guardAnswer = loginGuard.options.find(
    (option) => option.label === loginGuard.promptTarget,
  )?.id;
  const mfaLogin = await loginAuthSession(
    {
      email: admin.email,
      password: "super-secret-123",
      website: "",
      formStartedAt: new Date(Date.now() - 2_000).toISOString(),
      guardChallengeId: loginGuard.challengeId,
      guardAnswer,
    },
    mfaRequestContext,
  );
  assert(mfaLogin.status === 202 && mfaLogin.body.mfaRequired, "Admin login must require MFA.");
  assert(!mfaLogin.sessionToken, "Password-only admin login must not create a session.");
  assert(/^\d{6}$/.test(deliveredMfaCode), "MFA delivery must use a six-digit code.");
  const storedChallenge = (readLocalState().authChallenges || []).find(
    (item) => item.id === mfaLogin.body.challengeId,
  );
  assert(
    storedChallenge && !JSON.stringify(storedChallenge).includes(deliveredMfaCode),
    "MFA codes must only be stored as HMAC hashes.",
  );
  const verifiedMfa = await verifyMfaAuthSession(
    { challengeId: mfaLogin.body.challengeId, code: deliveredMfaCode },
    { clientIp: "127.0.0.1", headers: { "user-agent": "luenio-auth-test" } },
  );
  assert(verifiedMfa.sessionToken, "A valid one-time MFA code must create an admin session.");
  await assertRejectsWith(
    () =>
      verifyMfaAuthSession(
        { challengeId: mfaLogin.body.challengeId, code: deliveredMfaCode },
        { clientIp: "127.0.0.1", headers: { "user-agent": "luenio-auth-test" } },
      ),
    "Verification code is invalid.",
    "Reused MFA challenge",
  );
  process.env.ADMIN_MFA_REQUIRED = "false";
  globalThis.fetch = previousFetch;
  const inviteEmail = `invite-${Date.now()}@luenio.test`;
  const invitationResult = await createInvitation({
    actor: admin,
    body: { email: inviteEmail, businessName: "Invited Workspace", role: "client" },
  });
  assert(
    invitationResult.acceptanceUrl.includes("/aceptar-invitacion#token="),
    "Invitation creation must keep its one-time token out of HTTP query logs.",
  );
  const invitationToken = new URLSearchParams(
    new URL(invitationResult.acceptanceUrl).hash.replace(/^#/, ""),
  ).get("token");
  assert(invitationToken, "Invitation acceptance URL must contain its one-time token.");
  const invitedUser = await acceptInvitation({
    token: invitationToken,
    password: "invited-secret-123",
  });
  assert(
    invitedUser.businessId === invitationResult.invitation.businessId,
    "Accepted users must inherit the invited business scope.",
  );
  await assertRejectsWith(
    () => acceptInvitation({ token: invitationToken, password: "invited-secret-123" }),
    "Invitation is no longer available.",
    "Reused invitation token",
  );

  const adminInvitation = await createInvitation({
    actor: admin,
    body: {
      email: `invited-admin-${Date.now()}@luenio.test`,
      businessName: "Invited Admin Workspace",
      role: "admin",
    },
  });
  const adminInvitationToken = new URLSearchParams(
    new URL(adminInvitation.acceptanceUrl).hash.replace(/^#/, ""),
  ).get("token");
  const invitationHeaders = new Map();
  let invitationStatus = 0;
  let invitationBody = null;
  const invitationResponse = {
    setHeader(name, value) {
      invitationHeaders.set(String(name).toLowerCase(), value);
    },
    status(code) {
      invitationStatus = code;
      return this;
    },
    json(payload) {
      invitationBody = payload;
      return payload;
    },
  };
  await invitationsHandler(
    {
      method: "POST",
      pathname: "/api/invitations/accept",
      body: { token: adminInvitationToken, password: "admin-invite-secret-123" },
      clientIp: "127.0.0.1",
      headers: { "user-agent": "luenio-auth-test" },
    },
    invitationResponse,
  );
  assert(invitationStatus === 200, "A valid administrator invitation must be accepted.");
  assert(
    invitationBody?.mfaRequired === true && invitationBody?.authenticated === false,
    "Accepted administrators must sign in through MFA before receiving a session.",
  );
  assert(
    !invitationHeaders.has("set-cookie"),
    "Administrator invitation acceptance must never set a session cookie.",
  );

  const revocable = await createInvitation({
    actor: admin,
    body: {
      email: `revoked-${Date.now()}@luenio.test`,
      businessName: "Revoked Workspace",
      role: "client",
    },
  });
  await revokeInvitation({ invitationId: revocable.invitation.id, actor: admin });
  const revokedToken = new URLSearchParams(
    new URL(revocable.acceptanceUrl).hash.replace(/^#/, ""),
  ).get("token");
  await assertRejectsWith(
    () => acceptInvitation({ token: revokedToken, password: "revoked-secret-123" }),
    "Invitation is no longer available.",
    "Revoked invitation token",
  );

  await assertRejectsWith(
    () =>
      createUser({
        email: `${"a".repeat(250)}@luenio.test`,
        password: "super-secret-123",
        businessName: "Oversized Auth Workspace",
        plan: "starter",
      }),
    "Email is too long.",
    "Oversized email registration",
  );

  await assertRejectsWith(
    () =>
      createUser({
        email: "oversized-business@luenio.test",
        password: "super-secret-123",
        businessName: "B".repeat(121),
        plan: "starter",
      }),
    "Business name is too long.",
    "Oversized business registration",
  );

  await assertRejectsWith(
    () =>
      createUser({
        email: "oversized-password@luenio.test",
        password: "p".repeat(129),
        businessName: "Oversized Password Workspace",
        plan: "starter",
      }),
    "Password is too long.",
    "Oversized password registration",
  );

  await assertRejectsWith(
    () =>
      authenticateUser({
        email: "missing@luenio.test",
        password: "p".repeat(129),
      }),
    "Invalid email or password.",
    "Oversized password login",
  );

  writeLocalState({
    ...originalDatabase,
    users: [
      {
        id: "user_malformed_hash",
        email: "malformed-hash@luenio.test",
        businessName: "Malformed Hash Workspace",
        plan: "starter",
        passwordHash: "not-a-valid-password-hash",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...(originalDatabase.users || []),
    ],
  });

  let rejected = false;
  try {
    await authenticateUser({
      email: "malformed-hash@luenio.test",
      password: "super-secret-123",
    });
  } catch (error) {
    rejected = error.message === "Invalid email or password.";
  }

  assert(
    rejected,
    "Malformed password hashes must reject login without throwing low-level errors.",
  );

  console.info("Auth security guard passed");
} finally {
  if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAdminEmails;
  if (previousAdminMfaRequired === undefined) delete process.env.ADMIN_MFA_REQUIRED;
  else process.env.ADMIN_MFA_REQUIRED = previousAdminMfaRequired;
  if (previousMfaWebhookUrl === undefined) delete process.env.AUTH_MFA_WEBHOOK_URL;
  else process.env.AUTH_MFA_WEBHOOK_URL = previousMfaWebhookUrl;
  if (previousMfaWebhookToken === undefined) delete process.env.AUTH_MFA_WEBHOOK_TOKEN;
  else process.env.AUTH_MFA_WEBHOOK_TOKEN = previousMfaWebhookToken;
  globalThis.fetch = previousFetch;
  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
