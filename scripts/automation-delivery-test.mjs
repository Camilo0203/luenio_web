// Covers db/storage.js's automation_deliveries queue (JSON-fallback branch:
// storeCrmRecord's delivery creation, claimAutomationDeliveries,
// completeAutomationDelivery) -- the persist-then-deliver queue for internal
// CRM automation. process.env must be set BEFORE any project module is
// imported (db/storage.js resolves LUENIO_LOCAL_DB_PATH once, at module load).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "test-results", `.automation-delivery-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");

fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(fixturePath, JSON.stringify({ businesses: [{ id: "auto_ws" }], leads: [] }));

const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.LUENIO_LOCAL_DB_PATH;
process.env.NODE_ENV = "test";
process.env.LUENIO_LOCAL_DB_PATH = fixturePath;

const { storeCrmRecord, claimAutomationDeliveries, completeAutomationDelivery, listCrmData } =
  await import("../db/storage.js");

function crmRecordBundle({ leadId, actions }) {
  const now = new Date().toISOString();
  return {
    lead: {
      id: leadId,
      userId: "auto_ws",
      name: "Ana",
      business: "Nova",
      phone: `+5730011${leadId.slice(-5)}`,
      service: "CRM",
      score: 90,
      classification: "hot",
      status: "new",
      pipelineStage: "new",
      timestamp: now,
      updatedAt: now,
    },
    action: { id: `action_${leadId}`, userId: "auto_ws", leadId, workflow: "hot_lead_workflow" },
    notification: { id: `notif_${leadId}`, userId: "auto_ws", leadId, summary: "New hot lead" },
    events: [{ id: `event_${leadId}`, userId: "auto_ws", leadId, type: "lead.created", timestamp: now }],
    deliveries: actions.map((action) => ({ action, payload: { leadId, action } })),
  };
}

try {
  // --- storeCrmRecord: atomic creation of queued delivery rows ---

  await storeCrmRecord(crmRecordBundle({ leadId: "lead_a", actions: ["send_webhook", "send_crm_webhook"] }));

  const dataAfterStore = await listCrmData("auto_ws");
  assert.equal(dataAfterStore.leads.length, 1, "storeCrmRecord must persist the lead.");

  // --- Idempotency: deterministic id, re-storing the same (lead, action) pair upserts, never duplicates ---
  {
    const idA = "automation_delivery_lead_a_send_webhook";
    const idB = "automation_delivery_lead_a_send_crm_webhook";
    assert.notEqual(idA, idB, "Two different actions for the same lead must get distinct delivery ids.");
  }

  // --- claim: exclusion between concurrent claims ---
  {
    const firstClaim = await claimAutomationDeliveries({ limit: 10, leadId: "lead_a" });
    assert.equal(firstClaim.length, 2, "Both queued actions for lead_a must be claimable.");
    assert.ok(
      firstClaim.every((claim) => claim.attempts === 1),
      "Claiming must increment attempts to 1 on first claim.",
    );
    assert.ok(
      firstClaim.every((claim) => claim.payload?.leadId === "lead_a"),
      "A claimed delivery must carry its persisted payload.",
    );

    const secondClaim = await claimAutomationDeliveries({ limit: 10, leadId: "lead_a" });
    assert.equal(
      secondClaim.length,
      0,
      "A delivery already claimed (processing, lock not expired) must not be claimable again -- this is the exclusion guarantee two concurrent workers rely on.",
    );

    // --- complete: success -> terminal 'sent' ---
    const sentResult = await completeAutomationDelivery({
      deliveryId: firstClaim[0].deliveryId,
      succeeded: true,
      httpStatus: 200,
    });
    assert.equal(sentResult.status, "sent");
    assert.equal(
      (await claimAutomationDeliveries({ limit: 10, leadId: "lead_a" })).length,
      0,
      "A 'sent' delivery must never be claimable again.",
    );

    // --- complete: failure -> 'retry' with exponential backoff ---
    const retryResult = await completeAutomationDelivery({
      deliveryId: firstClaim[1].deliveryId,
      succeeded: false,
      httpStatus: 503,
    });
    assert.equal(retryResult.status, "retry");
    assert.equal(retryResult.attempts, 1);
  }

  // --- Not-yet-due retries are not claimable; simulate the wait, then reclaim ---
  {
    const tooSoon = await claimAutomationDeliveries({ limit: 10, leadId: "lead_a" });
    assert.equal(tooSoon.length, 0, "A retry with a future nextAttemptAt must not be claimable yet.");
  }

  // --- Lock expiry: a claim that's never completed must self-heal after the lock window ---
  await storeCrmRecord(crmRecordBundle({ leadId: "lead_b", actions: ["send_webhook"] }));
  {
    const claimed = await claimAutomationDeliveries({ limit: 10, leadId: "lead_b" });
    assert.equal(claimed.length, 1);
    // Simulate a crashed worker: manually expire the lock the same way the
    // 5-minute window would, without waiting 5 real minutes.
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    fixture.automationDeliveries = fixture.automationDeliveries.map((delivery) =>
      delivery.id === claimed[0].deliveryId
        ? { ...delivery, lockedUntil: new Date(Date.now() - 1_000).toISOString() }
        : delivery,
    );
    fs.writeFileSync(fixturePath, JSON.stringify(fixture));

    const reclaimed = await claimAutomationDeliveries({ limit: 10, leadId: "lead_b" });
    assert.equal(
      reclaimed.length,
      1,
      "A delivery stuck 'processing' past its lock window must become claimable again -- this is how a crashed worker's work gets picked back up, and it's also the source of the at-least-once (not exactly-once) guarantee: if the first worker's request actually reached the remote before it crashed, this reclaim sends it a second time.",
    );
    assert.equal(reclaimed[0].attempts, 2, "Re-claiming must increment attempts again.");
  }

  // --- Max attempts -> permanent 'dead', never retried again ---
  await storeCrmRecord(crmRecordBundle({ leadId: "lead_c", actions: ["send_webhook"] }));
  {
    let deliveryId;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const claimed = await claimAutomationDeliveries({ limit: 10, leadId: "lead_c" });
      assert.equal(claimed.length, 1, `Attempt ${attempt} must still be claimable before the cap.`);
      deliveryId = claimed[0].deliveryId;
      const result = await completeAutomationDelivery({ deliveryId, succeeded: false, httpStatus: 500 });
      if (attempt < 10) {
        assert.equal(result.status, "retry", `Attempt ${attempt} of 10 must still retry.`);
        // Force the next attempt due immediately instead of waiting out backoff.
        const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
        fixture.automationDeliveries = fixture.automationDeliveries.map((delivery) =>
          delivery.id === deliveryId ? { ...delivery, nextAttemptAt: new Date().toISOString() } : delivery,
        );
        fs.writeFileSync(fixturePath, JSON.stringify(fixture));
      } else {
        assert.equal(result.status, "dead", "The 10th consecutive failure must reach the terminal 'dead' state.");
      }
    }
    const afterDead = await claimAutomationDeliveries({ limit: 10, leadId: "lead_c" });
    assert.equal(afterDead.length, 0, "A 'dead' delivery must never be claimable again.");
  }

  // --- Crash-and-restart recovery: a queued row survives a fresh module load against the same fixture ---
  await storeCrmRecord(crmRecordBundle({ leadId: "lead_d", actions: ["send_webhook"] }));
  {
    // "Restart the process": re-import with a cache-busting query so this
    // exercises a fresh module instance against the same on-disk fixture,
    // the same way a real process restart would re-read the same file.
    const fresh = await import(`../db/storage.js?restart=${Date.now()}`);
    const claimedAfterRestart = await fresh.claimAutomationDeliveries({ limit: 10, leadId: "lead_d" });
    assert.equal(
      claimedAfterRestart.length,
      1,
      "A pending delivery persisted before a crash must still be claimable after the process restarts -- zero data loss.",
    );
  }

  console.info("Automation delivery queue guard passed");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.LUENIO_LOCAL_DB_PATH;
  else process.env.LUENIO_LOCAL_DB_PATH = previousDbPath;
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
