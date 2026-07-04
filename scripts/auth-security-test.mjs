import { authenticateUser, createSessionToken, createUser, verifySessionToken } from "../api/services/auth-service.js";
import { readLocalState, writeLocalState } from "../db/storage.js";
import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeSessionPayload(token) {
  const [encodedPayload] = token.split(".");
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
}

async function assertRejectsWith(operation, expectedMessage, label) {
  try {
    await operation();
  } catch (error) {
    assert(error.message === expectedMessage, `${label} must fail with "${expectedMessage}", got "${error.message}".`);
    return;
  }
  throw new Error(`${label} must reject.`);
}

const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;
const originalDatabase = readLocalState();

try {
  assert(verifySessionToken("not-a-session-token") === null, "Malformed session token must fail closed.");
  assert(verifySessionToken("payload.short") === null, "Wrong-length session signatures must fail closed.");
  assert(verifySessionToken("payload.signature.extra") === null, "Session tokens with extra segments must fail closed.");
  assert(verifySessionToken(".signature") === null, "Session tokens with empty payloads must fail closed.");
  assert(verifySessionToken("payload.") === null, "Session tokens with empty signatures must fail closed.");
  assert(verifySessionToken("%%%." + "x".repeat(43)) === null, "Malformed session payloads must fail closed.");

  const token = createSessionToken({ id: "user_auth_test", email: "auth-test@luenio.test" });
  const payload = decodeSessionPayload(token);
  assert(payload.sub === "user_auth_test", "Session token must include the stable user id.");
  assert(payload.exp, "Session token must include an expiration timestamp.");
  assert(!payload.email, "Session token payload must not include user email PII.");
  assert(!payload.businessName, "Session token payload must not include workspace PII.");
  const tamperedToken = `${token.split(".")[0]}.tampered`;
  assert(verifySessionToken(tamperedToken) === null, "Tampered session token must fail closed.");

  const createdUser = await createUser({
    email: `id-format-${Date.now()}@luenio.test`,
    password: "super-secret-123",
    businessName: "ID Format Workspace",
    plan: "starter",
  });
  assert(/^user_\d+_[a-f0-9]{32}$/.test(createdUser.id), "Created user ids must use the shared secure id format.");

  await assertRejectsWith(
    () => createUser({
      email: `${"a".repeat(250)}@luenio.test`,
      password: "super-secret-123",
      businessName: "Oversized Auth Workspace",
      plan: "starter",
    }),
    "Email is too long.",
    "Oversized email registration"
  );

  await assertRejectsWith(
    () => createUser({
      email: "oversized-business@luenio.test",
      password: "super-secret-123",
      businessName: "B".repeat(121),
      plan: "starter",
    }),
    "Business name is too long.",
    "Oversized business registration"
  );

  await assertRejectsWith(
    () => createUser({
      email: "oversized-password@luenio.test",
      password: "p".repeat(257),
      businessName: "Oversized Password Workspace",
      plan: "starter",
    }),
    "Password is too long.",
    "Oversized password registration"
  );

  await assertRejectsWith(
    () => authenticateUser({
      email: "missing@luenio.test",
      password: "p".repeat(257),
    }),
    "Password is too long.",
    "Oversized password login"
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

  assert(rejected, "Malformed password hashes must reject login without throwing low-level errors.");

  console.info("Auth security guard passed");
} finally {
  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
