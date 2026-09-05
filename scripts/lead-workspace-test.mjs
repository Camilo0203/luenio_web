// Covers api/services/lead-workspace-service.js, extracted from
// lead-processing-service.js: search, pagination, sort order, and the
// sparse-local-DB member fallback. process.env must be set BEFORE any
// project module is imported (db/storage.js resolves LUENIO_LOCAL_DB_PATH
// once, at module load).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(
  process.cwd(),
  "test-results",
  `.lead-workspace-fixture-${process.pid}`,
);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(
  fixturePath,
  JSON.stringify({
    businesses: [{ id: "ws_1" }],
    users: [{ id: "ws_1", email: "owner@nova.test", role: "admin", businessId: "ws_1" }],
    leads: [
      {
        id: "lead_old",
        userId: "ws_1",
        name: "Ana Pérez",
        business: "Nova Studio",
        tags: ["vip"],
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "lead_new",
        userId: "ws_1",
        name: "Carlos Ruiz",
        business: "LegalHub",
        tags: [],
        timestamp: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "lead_other_ws",
        userId: "ws_2",
        name: "Other Workspace Lead",
        business: "Other",
        tags: [],
        timestamp: "2026-06-15T00:00:00.000Z",
      },
    ],
  }),
);

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { listCrmWorkspace } = await import("../api/services/lead-workspace-service.js");

try {
  const owner = { id: "ws_1", businessId: "ws_1", email: "owner@nova.test" };

  {
    const result = await listCrmWorkspace(owner, {});
    assert.equal(result.ok, true);
    assert.equal(result.leads.length, 2, "Must scope leads to the caller's own workspace only.");
    assert.equal(result.leads[0].id, "lead_new", "Newest lead (by timestamp) must sort first.");
    assert.equal(result.leads[1].id, "lead_old");
  }

  {
    const result = await listCrmWorkspace(owner, { q: "nova" });
    assert.equal(result.leads.length, 1);
    assert.equal(
      result.leads[0].id,
      "lead_old",
      "Search must match on business name, case-insensitively.",
    );
  }

  {
    const result = await listCrmWorkspace(owner, { q: "vip" });
    assert.equal(result.leads.length, 1, "Search must match on tags.");
    assert.equal(result.leads[0].id, "lead_old");
  }

  {
    const page1 = await listCrmWorkspace(owner, { limit: 1 });
    assert.equal(page1.leads.length, 1);
    assert.equal(page1.leads[0].id, "lead_new");
    assert.equal(page1.pagination.nextCursor, "lead_new");

    const page2 = await listCrmWorkspace(owner, { limit: 1, cursor: page1.pagination.nextCursor });
    assert.equal(page2.leads.length, 1);
    assert.equal(page2.leads[0].id, "lead_old");
    assert.equal(page2.pagination.nextCursor, null, "The last page must not carry a next cursor.");
  }

  {
    const result = await listCrmWorkspace(owner, {});
    const member = result.members.find((row) => row.id === "ws_1");
    assert.ok(member, "A registered user must appear in the member list.");
    assert.equal(member.email, "owner@nova.test");
  }

  {
    // The sparse-local-DB fallback: caller not present in `users`, must still
    // appear in the returned member list so the UI can attribute records to them.
    const strangerCaller = { id: "ws_1_ghost", businessId: "ws_1", email: "ghost@nova.test" };
    const result = await listCrmWorkspace(strangerCaller, {});
    const member = result.members.find((row) => row.id === "ws_1_ghost");
    assert.ok(
      member,
      "The current caller must be synthesized into members even if absent from the local DB.",
    );
    assert.equal(member.email, "ghost@nova.test");
  }

  console.info("Lead workspace service guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
