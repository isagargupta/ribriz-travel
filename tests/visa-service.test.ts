import { test } from "node:test";
import assert from "node:assert/strict";
import { addWorkingDays, autoStage, deadlineCheck, stageIndex, visaPrice, visaReadyBy } from "../lib/visa-service-rules.ts";

test("price: government fee + service fee + 18% GST on the service fee, per traveller", () => {
  const p = visaPrice({ govtFee: 2150, serviceFee: 999 }, 3);
  assert.deepEqual(p, { govt: 2150, service: 999, gst: 180, perPerson: 3329, travellers: 3, total: 9987 });
  assert.equal(visaPrice({ govtFee: 0, serviceFee: 499 }, 0).travellers, 1);
});

test("working days skip weekends", () => {
  assert.equal(addWorkingDays(new Date("2026-11-27T00:00:00Z"), 1).toISOString().slice(0, 10), "2026-11-30"); // Fri → Mon
  assert.equal(addWorkingDays(new Date("2026-11-23T00:00:00Z"), 5).toISOString().slice(0, 10), "2026-11-30"); // Mon + 5
});

test("ready-by date: one day for our check plus processing; late in the day starts tomorrow", () => {
  assert.equal(visaReadyBy(new Date("2026-11-23T04:00:00Z"), 3), "2026-11-27"); // Mon 9:30am IST: Tue check, ready Fri
  assert.equal(visaReadyBy(new Date("2026-11-23T12:00:00Z"), 3), "2026-11-30"); // Mon 5:30pm IST: starts Tue
});

test("deadline check against the flight", () => {
  assert.equal(deadlineCheck("2026-12-01", "2026-12-10"), "ok");
  assert.equal(deadlineCheck("2026-12-01", "2026-12-02"), "tight");
  assert.equal(deadlineCheck("2026-12-05", "2026-12-02"), "late");
  assert.equal(deadlineCheck("2026-12-05", null), null);
});

test("stages move on from the facts, and the team's stages stick", () => {
  assert.equal(autoStage("documents", { docsComplete: true, paid: false }), "payment");
  assert.equal(autoStage("payment", { docsComplete: true, paid: true }), "review");
  assert.equal(autoStage("documents", { docsComplete: false, paid: true }), "documents");
  assert.equal(autoStage("submitted", { docsComplete: false, paid: false }), "submitted");
  assert.equal(stageIndex("approved"), 4);
  assert.equal(stageIndex("rejected"), -1);
});
