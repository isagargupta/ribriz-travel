import { test } from "node:test";
import assert from "node:assert/strict";
import { can, clientEmail, clientKey, followUpBucket, pickAssignee, quickDue } from "../lib/staff-rules.ts";

test("roles: agents work, managers handle money and see everyone, only owners manage the team", () => {
  assert.equal(can("agent", "work"), true);
  assert.equal(can("agent", "money"), false);
  assert.equal(can("agent", "seeAll"), false);
  assert.equal(can("manager", "money"), true);
  assert.equal(can("manager", "team"), false);
  assert.equal(can("owner", "team"), true);
});

test("new work goes to the least busy, then the one assigned longest ago", () => {
  assert.equal(pickAssignee([{ id: "a", open: 5, lastAssignedAt: 1 }, { id: "b", open: 2, lastAssignedAt: 9 }]), "b");
  assert.equal(pickAssignee([{ id: "a", open: 2, lastAssignedAt: 5 }, { id: "b", open: 2, lastAssignedAt: 1 }]), "b");
  assert.equal(pickAssignee([]), null);
});

test("follow-ups: overdue, today and upcoming in India time", () => {
  const now = new Date("2026-11-27T06:30:00Z"); // 12:00 IST
  assert.equal(followUpBucket(new Date("2026-11-26T12:00:00Z"), now), "overdue");
  assert.equal(followUpBucket(new Date("2026-11-27T04:30:00Z"), now), "overdue"); // 10am today, passed
  assert.equal(followUpBucket(new Date("2026-11-27T12:00:00Z"), now), "today");   // 5:30pm today
  assert.equal(followUpBucket(new Date("2026-11-28T04:30:00Z"), now), "upcoming");
  assert.equal(quickDue(now, "tomorrow").toISOString(), "2026-11-28T04:30:00.000Z"); // 10am IST tomorrow
});

test("client keys round-trip and ignore case", () => {
  assert.equal(clientEmail(clientKey(" Asha@Example.com ")), "asha@example.com");
});
