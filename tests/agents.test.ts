import { test } from "node:test";
import assert from "node:assert/strict";
import { docsReminder, holdStage, isMeaningfulDrop, isPreTrip, visaReminder } from "../lib/agents/rules.ts";

test("price drops must be meaningful", () => {
  assert.ok(isMeaningfulDrop(85000, 82000));
  assert.ok(!isMeaningfulDrop(85000, 84500)); // under ₹1,000
  assert.ok(!isMeaningfulDrop(300000, 298000)); // under 2%
  assert.ok(!isMeaningfulDrop(80000, 82000)); // went up
});

test("hold stages", () => {
  const made = new Date("2026-11-20T10:00:00Z");
  const at = (h: number) => new Date(made.getTime() + h * 3600e3);
  assert.equal(holdStage(made, at(10)), null);
  assert.equal(holdStage(made, at(31)), "expiring");
  assert.equal(holdStage(made, at(50)), "expired");
  assert.equal(holdStage(made, at(100)), null);
});

test("visa, documents and pre-trip timing", () => {
  assert.equal(visaReminder("2026-12-31", "2026-12-01"), null);
  assert.equal(visaReminder("2026-12-10", "2026-12-01")?.daysLeft, 9);
  assert.equal(visaReminder("2026-11-25", "2026-12-01")?.daysLeft, -6);
  assert.equal(visaReminder(null, "2026-12-01"), null);
  assert.equal(docsReminder("2027-03-30", "2026-12-01"), null);
  assert.equal(docsReminder("2027-01-15", "2026-12-01")?.daysToGo, 45);
  assert.ok(isPreTrip("2026-12-04", "2026-12-01") && !isPreTrip("2026-12-05", "2026-12-01") && !isPreTrip("2026-11-30", "2026-12-01"));
});
