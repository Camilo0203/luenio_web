import assert from "node:assert/strict";
import { buildWorkQueue, matchesSmartFilter } from "../apps/admin/src/work-queue.js";
import {
  buildDailyDigest,
  buildDigestWebhookPayload,
  isDigestActionable,
  shouldSendDigest,
} from "../api/services/digest-service.js";
import { isDigestDeliveryConfigured } from "../config/env.js";
import { appendContactLog, normalizeContactLogEntry, normalizeNextAction } from "../core/engine.js";

const now = new Date("2026-07-22T15:00:00.000Z");

const leads = [
  {
    id: "1",
    name: "Due",
    classification: "warm",
    status: "qualified",
    nextAction: "Llamar",
    nextActionAt: "2026-07-22T10:00:00.000Z",
  },
  {
    id: "2",
    name: "Stale Hot",
    classification: "hot",
    status: "new",
    lastContactedAt: "2026-07-19T15:00:00.000Z",
  },
  {
    id: "3",
    name: "No contact",
    classification: "warm",
    status: "new",
  },
  {
    id: "4",
    name: "Converted",
    classification: "hot",
    status: "converted",
    nextActionAt: "2026-07-22T10:00:00.000Z",
  },
];

assert.equal(matchesSmartFilter(leads[0], "due_today", now), true);
assert.equal(matchesSmartFilter(leads[1], "stale_hot", now), true);
assert.equal(matchesSmartFilter(leads[2], "no_contact", now), true);
assert.equal(matchesSmartFilter(leads[3], "due_today", now), false);

const queue = buildWorkQueue(leads, { now, limit: 5 });
assert.equal(queue[0].id, "1", "Overdue next action should rank first");
assert.ok(queue.some((lead) => lead.id === "2"));
assert.ok(!queue.some((lead) => lead.id === "4"));

const entry = normalizeContactLogEntry({ type: "whatsapp", summary: "Respondió" });
assert.ok(entry.id.startsWith("clog_"));
const log = appendContactLog([], entry);
assert.equal(log.length, 1);
assert.equal(normalizeNextAction("  x".repeat(100)).length <= 200, true);

const digest = buildDailyDigest(leads, { now });
assert.equal(digest.totals.leads, 4);
assert.ok(digest.totals.staleHot >= 1);
assert.ok(digest.dueToday.length >= 1);
assert.equal(isDigestActionable(digest), true);

const emptyDigest = buildDailyDigest(
  [{ id: "x", classification: "cold", status: "converted", lastContactedAt: now.toISOString() }],
  { now },
);
assert.equal(isDigestActionable(emptyDigest), false);
assert.equal(
  shouldSendDigest(emptyDigest, {
    config: { onlyIfActionable: true, minHoursBetweenSends: 20 },
    lastSentAt: 0,
    now: now.getTime(),
  }),
  false,
);
assert.equal(
  shouldSendDigest(digest, {
    config: { onlyIfActionable: true, minHoursBetweenSends: 20 },
    lastSentAt: now.getTime() - 60 * 60 * 1000,
    now: now.getTime(),
  }),
  false,
  "Must throttle sends within min hours",
);
assert.equal(
  shouldSendDigest(digest, {
    config: { onlyIfActionable: true, minHoursBetweenSends: 20 },
    lastSentAt: 0,
    now: now.getTime(),
  }),
  true,
);

const payload = buildDigestWebhookPayload({
  workspaceId: "biz_1",
  digest,
  recipient: "ops@example.com",
});
assert.equal(payload.type, "luenio.crm.daily_digest");
assert.equal(payload.workspaceId, "biz_1");
assert.ok(payload.summary.dueToday >= 1);

assert.equal(
  isDigestDeliveryConfigured({
    cronEnabled: false,
    webhookUrl: "",
    webhookToken: "",
    workerIntervalMs: 3600000,
    minHoursBetweenSends: 20,
  }),
  false,
);
assert.equal(
  isDigestDeliveryConfigured({
    cronEnabled: true,
    webhookUrl: "https://automation.example.com/webhook/digest",
    webhookToken: "x".repeat(32),
    workerIntervalMs: 3600000,
    minHoursBetweenSends: 20,
  }),
  true,
);

console.info("Work queue and digest guards passed");
