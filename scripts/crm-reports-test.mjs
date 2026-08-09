import assert from "node:assert/strict";
import { buildCrmReports } from "../apps/admin/src/reports.js";

const now = new Date("2026-07-22T15:00:00.000Z");

const leads = [
  {
    id: "1",
    name: "A",
    source: "hero",
    classification: "hot",
    status: "new",
    timestamp: "2026-07-20T12:00:00.000Z",
  },
  {
    id: "2",
    name: "B",
    source: "hero",
    classification: "warm",
    status: "qualified",
    timestamp: "2026-07-18T12:00:00.000Z",
  },
  {
    id: "3",
    name: "C",
    source: "pricing",
    classification: "hot",
    status: "contacted",
    timestamp: "2026-07-21T12:00:00.000Z",
    lastContactedAt: null,
  },
  {
    id: "4",
    name: "Old",
    source: "old_campaign",
    classification: "cold",
    status: "converted",
    timestamp: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "5",
    name: "Demo",
    source: "live_demo",
    classification: "hot",
    status: "new",
    timestamp: "2026-07-22T12:00:00.000Z",
    demo: true,
  },
];

const report30 = buildCrmReports(leads, { now, days: 30 });
assert.equal(report30.days, 30);
assert.equal(report30.totals.leads, 3, "30d window excludes old + demo");
assert.equal(report30.totals.allTime, 4, "allTime excludes demo only");
assert.ok(report30.sources.some((row) => row.source === "hero" && row.count === 2));
assert.ok(report30.funnel.find((row) => row.stage === "new")?.count >= 1);
assert.ok(report30.totals.staleHot >= 1);

const report7 = buildCrmReports(leads, { now, days: 7 });
assert.equal(report7.days, 7);
assert.ok(report7.totals.leads <= report30.totals.leads);

console.info("CRM reports guard passed");
