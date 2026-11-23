import { test } from "node:test";
import assert from "node:assert/strict";
import { addWorkingHours, rankWork, type WorkInput } from "../lib/inbox-rules.ts";

// India time helpers: "2026-11-24T10:00" IST
const ist = (s: string) => new Date(s + ":00+05:30");
const base: WorkInput = { type: "forex", status: "new", createdAt: ist("2026-11-24T10:00"), quotedTotal: null, departure: null, lastTeamMessageAt: null, chosenUnbooked: false, optionsWaiting: false };

test("working hours skip nights and Sundays", () => {
  assert.equal(addWorkingHours(ist("2026-11-24T10:00"), 2).getTime(), ist("2026-11-24T12:00").getTime());
  assert.equal(addWorkingHours(ist("2026-11-24T19:00"), 2).getTime(), ist("2026-11-25T10:00").getTime()); // 1h today, 1h tomorrow
  assert.equal(addWorkingHours(ist("2026-11-28T19:30"), 1).getTime(), ist("2026-11-30T09:30").getTime()); // Sat evening → Mon
  assert.equal(addWorkingHours(ist("2026-11-24T06:00"), 1).getTime(), ist("2026-11-24T10:00").getTime()); // before opening
});

test("overdue beats new; chosen options beat everything", () => {
  const fresh = rankWork(base, ist("2026-11-24T10:30"))!;
  const late = rankWork(base, ist("2026-11-24T15:00"))!;
  const chosen = rankWork({ ...base, status: "contacted", lastTeamMessageAt: ist("2026-11-24T11:00"), chosenUnbooked: true }, ist("2026-11-24T12:00"))!;
  assert.ok(late.score > fresh.score);
  assert.match(late.reasons[0], /overdue by 3 h/);
  assert.ok(chosen.score > late.score);
  assert.equal(chosen.level, "urgent");
  assert.match(chosen.next, /Book/);
});

test("holds: ending soon, ended; finished work drops out", () => {
  const hold = { ...base, type: "hold", status: "contacted", lastTeamMessageAt: ist("2026-11-24T11:00"), quotedTotal: 300000 };
  const ending = rankWork(hold, ist("2026-11-26T02:00"))!;
  assert.ok(ending.reasons.some((r) => /Hold ends in 8 h/.test(r)));
  assert.match(ending.next, /deposit/);
  assert.match(rankWork(hold, ist("2026-11-27T10:00"))!.next, /hold again/);
  assert.equal(rankWork({ ...base, status: "closed" }, ist("2026-11-24T12:00")), null);
  assert.equal(rankWork({ ...base, status: "booked" }, ist("2026-11-24T12:00")), null);
});

test("visa ready to file, departure close, quiet requests and waiting on customer", () => {
  const visa = rankWork({ ...base, type: "visa", status: "contacted", lastTeamMessageAt: ist("2026-11-24T11:00"), docsReady: true, departure: "2026-12-01" }, ist("2026-11-24T12:00"))!;
  assert.match(visa.next, /File the visa/);
  assert.ok(visa.reasons.includes("Leaves in 7 days"));
  const quiet = rankWork({ ...base, status: "contacted", lastTeamMessageAt: ist("2026-11-20T11:00") }, ist("2026-11-24T12:00"))!;
  assert.ok(quiet.reasons.some((r) => /No update for 4 days/.test(r)));
  const waiting = rankWork({ ...base, status: "contacted", lastTeamMessageAt: ist("2026-11-24T11:00"), optionsWaiting: true }, ist("2026-11-24T12:00"))!;
  assert.equal(waiting.level, "fyi");
});

test("after a reply, the next step is on the customer", () => {
  const r = rankWork({ ...base, status: "contacted", lastTeamMessageAt: ist("2026-11-24T11:00") }, ist("2026-11-24T12:00"))!;
  assert.match(r.next, /Wait for the customer/);
  assert.ok(r.reasons.includes("Replied today"));
  assert.equal(r.level, "fyi");
});
