// Covers api/services/digest-service.js: deliverWorkspaceDigests() webhook
// delivery — the scenarios buildDailyDigest()/shouldSendDigest() pure-function
// coverage in work-queue-test.mjs does not exercise (network I/O, multi
// workspace isolation, and the DIGEST_WEBHOOK_URL config-error guard).
//
// process.env must be set BEFORE any project module is imported: db/storage.js
// resolves its local DB path from LUENIO_LOCAL_DB_PATH once, at module load.
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(
  process.cwd(),
  "test-results",
  `.digest-delivery-fixture-${process.pid}`,
);
const fixturePath = path.join(fixtureDir, "leads-db.json");
const now = new Date("2026-07-22T15:00:00.000Z");
const dueAt = "2026-07-22T09:00:00.000Z"; // before `now` on the same local day -> due today

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(
  fixturePath,
  JSON.stringify({
    businesses: [{ id: "digest_ws_ok" }, { id: "digest_ws_network" }, { id: "digest_ws_http" }],
    leads: [
      {
        id: "lead_ok",
        userId: "digest_ws_ok",
        name: "Workspace OK",
        classification: "hot",
        status: "new",
        nextActionAt: dueAt,
      },
      {
        id: "lead_network",
        userId: "digest_ws_network",
        name: "Workspace Network Failure",
        classification: "hot",
        status: "new",
        nextActionAt: dueAt,
      },
      {
        id: "lead_http",
        userId: "digest_ws_http",
        name: "Workspace HTTP Failure",
        classification: "hot",
        status: "new",
        nextActionAt: dueAt,
      },
    ],
  }),
);

const envKeys = [
  "NODE_ENV",
  "LUENIO_LOCAL_DB_PATH",
  "DIGEST_CRON_ENABLED",
  "DIGEST_WEBHOOK_URL",
  "DIGEST_WEBHOOK_TOKEN",
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;
process.env.DIGEST_CRON_ENABLED = "true";
process.env.DIGEST_WEBHOOK_URL = "https://digest.example.com/webhook";
process.env.DIGEST_WEBHOOK_TOKEN = "digest-test-token-32-characters-min";

const { deliverWorkspaceDigests } = await import("../api/services/digest-service.js");

try {
  // (a) Production without a configured DIGEST_WEBHOOK_TOKEN must never
  // attempt delivery (no `Authorization: Bearer undefined`) and must return
  // the same safe empty result as "not configured at all" — not throw.
  {
    process.env.NODE_ENV = "production";
    delete process.env.DIGEST_WEBHOOK_TOKEN;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("fetch must not be called when the digest token is missing");
    };

    const result = await deliverWorkspaceDigests({ now });

    assert(!fetchCalled, "Missing DIGEST_WEBHOOK_TOKEN in production must not attempt any send.");
    assert(
      result.sent === 0 && result.skipped === 0,
      "Unconfigured digest delivery must be a no-op.",
    );
    assert(
      result.workspaceCount === 0,
      "Unconfigured digest delivery must not enumerate workspaces.",
    );
    assert(
      Array.isArray(result.results) && result.results.length === 0,
      "results must stay empty.",
    );
    assert(
      result.configError === undefined,
      "Missing token is 'not configured', not a config error.",
    );

    process.env.DIGEST_WEBHOOK_TOKEN = "digest-test-token-32-characters-min";
  }

  // (b) A DIGEST_WEBHOOK_URL that passes the cheap regex in
  // isDigestDeliveryConfigured() but fails full validation (private address
  // in production) must return a structured configError, not throw, and must
  // not touch the database.
  {
    process.env.NODE_ENV = "production";
    process.env.DIGEST_WEBHOOK_URL = "https://127.0.0.1/webhook";
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("fetch must not be called when DIGEST_WEBHOOK_URL is invalid");
    };

    const result = await deliverWorkspaceDigests({ now });

    assert(!fetchCalled, "An invalid webhook URL must not reach fetch.");
    assert(
      typeof result.configError === "string" && result.configError.length > 0,
      "configError must be reported.",
    );
    assert(
      result.sent === 0 && result.skipped === 0 && result.workspaceCount === 0,
      "A config error must short-circuit before touching any workspace.",
    );
    assert(
      Array.isArray(result.results) && result.results.length === 0,
      "results must stay empty.",
    );

    process.env.NODE_ENV = "test";
    process.env.DIGEST_WEBHOOK_URL = "https://digest.example.com/webhook";
  }

  // (c)+(d)+(e)+(f) Three workspaces, three independent outcomes in one run:
  // one send succeeds, one throws (network/timeout-style failure), one
  // resolves with a non-2xx HTTP response. A failure on one workspace must
  // never stop the others, and the public result shape must match the
  // pre-refactor contract exactly.
  {
    const callsByWorkspace = [];
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      callsByWorkspace.push(body.workspaceId);
      assert(
        options.headers.Authorization === "Bearer digest-test-token-32-characters-min",
        "Every digest delivery must use the configured bearer token.",
      );
      if (body.workspaceId === "digest_ws_network") {
        throw new Error("simulated network failure");
      }
      if (body.workspaceId === "digest_ws_http") {
        return { ok: false, status: 503 };
      }
      return { ok: true, status: 200 };
    };

    const result = await deliverWorkspaceDigests({ now });

    assert(
      callsByWorkspace.length === 3 &&
        callsByWorkspace.includes("digest_ws_ok") &&
        callsByWorkspace.includes("digest_ws_network") &&
        callsByWorkspace.includes("digest_ws_http"),
      "All three workspaces must be attempted; one failure must not stop the loop.",
    );
    assert(result.sent === 1, "Exactly one workspace should have sent successfully.");
    assert(result.skipped === 2, "The network failure and the HTTP failure both count as skipped.");
    assert(result.workspaceCount === 3, "workspaceCount must reflect every enumerated workspace.");
    assert(result.configError === undefined, "A normal run must not carry a configError field.");

    const byWorkspace = Object.fromEntries(result.results.map((row) => [row.workspaceId, row]));
    assert(byWorkspace.digest_ws_ok?.status === "sent", "Successful delivery must be marked sent.");
    assert(
      byWorkspace.digest_ws_network?.status === "network_error",
      "A thrown delivery error must be marked network_error, matching the pre-refactor contract.",
    );
    assert(
      byWorkspace.digest_ws_http?.status === "http_error" &&
        byWorkspace.digest_ws_http?.httpStatus === 503,
      "A non-2xx response must be marked http_error with the original httpStatus.",
    );
  }

  console.info("Digest delivery guard passed");
} finally {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
  globalThis.fetch = previousFetch;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
