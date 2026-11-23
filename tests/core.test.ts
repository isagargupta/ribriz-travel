import { test } from "node:test";
import assert from "node:assert/strict";
import { adultPrice, addDays, daysBetween, emi, quote, savingPct } from "../lib/pricing.ts";
import { editDistance, scoreFields, searchItems, tripFields } from "../lib/search.ts";
import { buildSchedule } from "../lib/schedule.ts";

test("adult price adds departure delta and city flight supplement", () => {
  assert.equal(adultPrice(50000, 0, true, "Mumbai"), 50000);
  assert.equal(adultPrice(50000, 2000, true, "Delhi"), 55000);
  assert.equal(adultPrice(50000, 2000, false, "Delhi"), 52000); // no flight, no supplement
});

test("quote: adults, child bands, 5% GST, deposit", () => {
  const q = quote({ base: 100000, flight: false, adults: 2, childAges: [1, 4, 9] });
  assert.equal(q.perAdult, 100000);
  assert.deepEqual(q.lines.map((l) => l.amount), [200000, 10000, 50000, 70000]);
  assert.equal(q.subtotal, 330000);
  assert.equal(q.gst, 16500);
  assert.equal(q.total, 346500);
  assert.equal(q.travellers, 5);
  assert.equal(q.deposit, 34650);
});

test("quote clamps bad input", () => {
  const q = quote({ base: 10000, flight: false, adults: 0, childAges: [99] });
  assert.equal(q.lines[0].amount, 10000); // at least 1 adult
  assert.equal(q.lines[1].amount, 7000); // age clamped to 11 → 70%
  assert.equal(quote({ base: 1000, flight: false, adults: 1 }).deposit, 5000); // minimum deposit
});

test("EMI: no-cost up to 6 months, interest after", () => {
  assert.equal(emi(60000, 6), 10000);
  assert.ok(emi(120000, 12) > 10000);
});

test("saving percentage", () => {
  assert.equal(savingPct({ price: 80000, was: 100000 }), 20);
  assert.equal(savingPct({ price: 80000, was: null }), 0);
});

test("calendar date helpers cross months and years", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
});

test("edit distance handles typos and transpositions", () => {
  assert.equal(editDistance("maldives", "maldives"), 0);
  assert.equal(editDistance("maldvies", "maldives"), 1);
  assert.equal(editDistance("kashmr", "kashmir"), 1);
  assert.ok(editDistance("bali", "kerala") > 2);
});

test("search finds trips despite typos and ranks destination first", () => {
  const trips = [
    { id: "a", dest: "Maldives", country: "Maldives", region: "Indian Ocean", title: "Water villa escape", themes: ["beach"] },
    { id: "b", dest: "Bali", country: "Indonesia", region: "South-East Asia", title: "Rice terraces", themes: ["honeymoon"] },
    { id: "c", dest: "Kashmir", country: "India", region: "India", title: "Gulmarg and Dal Lake", themes: ["nature"] },
  ];
  assert.equal(searchItems("maldvies", trips, tripFields)[0].id, "a");
  assert.equal(searchItems("indo", trips, tripFields)[0].id, "b");
  assert.equal(searchItems("dal lake", trips, tripFields)[0].id, "c");
  assert.equal(searchItems("zzzz", trips, tripFields).length, 0);
  assert.equal(scoreFields("", [{ text: "x", weight: 1 }]), 0);
});

test("schedule: stays inside window, spaced, seats only for group tours", () => {
  const s = buildSchedule({ tripId: "t1", kind: "escorted", base: 50000, start: "2026-01-01", days: 90 });
  assert.ok(s.length >= 8);
  for (let i = 1; i < s.length; i++) assert.equal(daysBetween(s[i - 1].date, s[i].date), 10);
  assert.ok(s.every((d) => d.seatsLeft !== null && d.seatsLeft >= 2));
  assert.ok(s.every((d) => daysBetween("2026-01-01", d.date) <= 90));
  const h = buildSchedule({ tripId: "t2", kind: "hotel", base: 20000, start: "2026-01-01", days: 30 });
  assert.ok(h.every((d) => d.seatsLeft === null));
  // year-end peak is pricier than monsoon for the same trip
  const peak = buildSchedule({ tripId: "t3", kind: "hotel", base: 100000, start: "2026-12-20", days: 6, every: 1 });
  const low = buildSchedule({ tripId: "t3", kind: "hotel", base: 100000, start: "2026-07-10", days: 6, every: 1 });
  const avg = (a: { priceDelta: number }[]) => a.reduce((s, x) => s + x.priceDelta, 0) / a.length;
  assert.ok(avg(peak) > avg(low));
});
