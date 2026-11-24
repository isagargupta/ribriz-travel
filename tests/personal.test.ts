import { test } from "node:test";
import assert from "node:assert/strict";
import { addNote, cleanNote, combinePrefs, describePrefs, mergePrefs } from "../lib/profile-rules.ts";
import { recommend, type RecTrip } from "../lib/recommend.ts";

const T = (id: string, o: Partial<RecTrip>): RecTrip => ({ id, dest: id, region: "Europe", title: id, themes: [], price: 100000, was: null, rating: null, depDates: ["2027-03-10"], countryCodes: ["FR"], lastMinute: false, ...o });
const trips = [
  T("bali", { region: "South-East Asia", themes: ["beach", "honeymoon"], price: 90000 }),
  T("phuket", { region: "South-East Asia", themes: ["beach"], price: 70000 }),
  T("maldives", { region: "Indian Ocean", themes: ["beach", "luxury"], price: 250000 }),
  T("swiss", { region: "Europe", themes: ["nature"], price: 220000, depDates: ["2027-06-01"] }),
  T("rajasthan", { region: "India", themes: ["heritage"], price: 40000 }),
  T("kerala", { region: "India", themes: ["nature", "family"], price: 35000, depDates: [] }),
];

test("no signal, no guesses", () => {
  assert.deepEqual(recommend(trips, {}, { viewed: [], saved: [], active: [] }), []);
});

test("stated likes and budget rank beach trips in budget first, with a reason", () => {
  const r = recommend(trips, { likes: ["beach"], budgetPerAdult: 100000 }, { viewed: [], saved: [], active: [] });
  assert.ok(["bali", "phuket"].includes(r[0].id));
  assert.match(r[0].reason, /beach|budget/);
  const mal = r.findIndex((x) => x.id === "maldives");
  assert.ok(mal === -1 || mal > r.findIndex((x) => x.id === "phuket")); // way over budget: last, or left out
});

test("behaviour: saved trips are excluded but steer the rest; reasons cite them", () => {
  const r = recommend(trips, {}, { viewed: [], saved: ["bali"], active: [] });
  assert.ok(!r.some((x) => x.id === "bali"));
  assert.equal(r[0].id, "phuket");
  assert.equal(r[0].reason, "Because you liked bali");
});

test("avoid words and months; diversity spreads regions", () => {
  const r = recommend(trips, { likes: ["beach", "nature", "heritage"], avoid: ["luxury"], months: [3] }, { viewed: [], saved: [], active: [] });
  assert.ok(!r.slice(0, 3).some((x) => x.id === "maldives"));
  const regions = r.slice(0, 3).map((x) => trips.find((t) => t.id === x.id)!.region);
  assert.ok(new Set(regions).size >= 2);
});

test("preferences merge, clear and combine on sign-in", () => {
  const a = mergePrefs({ likes: ["beach"], pace: "relaxed" }, { likes: ["beach", "nature"], pace: null, budgetPerAdult: 150000 });
  assert.deepEqual(a, { likes: ["beach", "nature"], budgetPerAdult: 150000 });
  const c = combinePrefs({ likes: ["beach"], budgetPerAdult: 100000 }, { likes: ["heritage"], budgetPerAdult: 50000, dietary: "vegetarian" });
  assert.deepEqual(c.likes, ["beach", "heritage"]);
  assert.equal(c.budgetPerAdult, 100000);
  assert.equal(c.dietary, "vegetarian");
  assert.ok(describePrefs(c).some((l) => l.includes("₹1,00,000")));
});

test("notes refuse ID numbers and emails, de-duplicate and cap", () => {
  assert.equal(cleanNote("My passport is K1234567"), null);
  assert.equal(cleanNote("card 4111 1111 1111 1111"), null);
  assert.equal(cleanNote("mail me at a@b.com"), null);
  assert.equal(cleanNote("Celebrating our 10th anniversary in March"), "Celebrating our 10th anniversary in March");
  let n = addNote([], "Prefers window seats", "1", "t");
  n = addNote(n, "prefers window seats", "2", "t");
  assert.equal(n.length, 1);
});

test("avoiding long flights favours nearby regions, and reasons vary", () => {
  const r = recommend(trips, { likes: ["beach", "nature"], avoid: ["long flights"] }, { viewed: [], saved: [], active: [] });
  assert.ok(r.findIndex((x) => x.id === "swiss") > r.findIndex((x) => x.id === "phuket"));
  const counts = new Map<string, number>();
  for (const x of r) counts.set(x.reason, (counts.get(x.reason) ?? 0) + 1);
  assert.ok([...counts.values()].every((n) => n <= 2));
});
