import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBulk, seasonDates } from "../lib/season-rules.ts";

test("weekday seasons: every Friday and Sunday in June 2027", () => {
  const d = seasonDates({ from: "2027-06-01", to: "2027-06-30", weekdays: [5, 0] });
  assert.equal(d[0], "2027-06-04"); // first Friday
  assert.equal(d.length, 8);
  assert.ok(d.every((x) => [5, 0].includes(new Date(x + "T00:00:00Z").getUTCDay())));
});

test("every-N-days seasons count from the start date and include the end", () => {
  assert.deepEqual(seasonDates({ from: "2027-10-01", to: "2027-10-21", weekdays: [], every: 10 }), ["2027-10-01", "2027-10-11", "2027-10-21"]);
});

test("seasons skip dates that are too soon, and bad ranges give nothing", () => {
  const d = seasonDates({ from: "2027-01-01", to: "2027-01-10", weekdays: [], every: 1, notBefore: "2027-01-08" });
  assert.deepEqual(d, ["2027-01-08", "2027-01-09", "2027-01-10"]);
  assert.deepEqual(seasonDates({ from: "2027-02-01", to: "2027-01-01", weekdays: [1] }), []);
  assert.equal(seasonDates({ from: "2027-01-01", to: "2029-12-31", weekdays: [], every: 1 }).length, 400); // capped
});

test("bulk changes: surcharges add up, seats and status change, booked dates survive delete", () => {
  const d = { priceDelta: 2000, seatsLeft: 10, status: "open", booked: false };
  assert.deepEqual(applyBulk(d, "add_delta", 5000), { priceDelta: 7000, seatsLeft: 10, status: "open", booked: false });
  assert.equal((applyBulk(d, "set_delta", -1500) as { priceDelta: number }).priceDelta, -1500);
  assert.equal((applyBulk(d, "set_seats", null) as { seatsLeft: number | null }).seatsLeft, null);
  assert.equal((applyBulk(d, "close", null) as { status: string }).status, "closed");
  assert.equal(applyBulk(d, "delete", null), null);
  assert.equal(applyBulk({ ...d, booked: true }, "delete", null), "keep");
});
