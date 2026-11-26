import { test } from "node:test";
import assert from "node:assert/strict";
import { climateByMonth, monthRanges, monthScore, slugify } from "../lib/climate-rules.ts";

test("pleasant warm dry months score high; monsoon, cold and heat score low", () => {
  assert.equal(monthScore(28, 40), 100);
  assert.ok(monthScore(28, 500) < 40); // Kerala monsoon
  assert.ok(monthScore(5, 2) < 45);  // cold
  assert.ok(monthScore(42, 0) < 45); // desert summer
  assert.ok(monthScore(42, 0) < monthScore(14, 0));
});

test("daily history averages into months over several years", () => {
  const time: string[] = [], tmax: number[] = [], tmin: number[] = [], rain: number[] = [];
  for (const y of [2023, 2024]) for (let d = 1; d <= 31; d++) {
    time.push(`${y}-01-${String(d).padStart(2, "0")}`); tmax.push(28); tmin.push(20); rain.push(d <= 3 ? 10 : 0); // 30 mm a January
    if (d <= 30) { time.push(`${y}-07-${String(d).padStart(2, "0")}`); tmax.push(30); tmin.push(25); rain.push(16); } // 480 mm July
  }
  const c = climateByMonth({ time, tmax, tmin, rain });
  assert.deepEqual([c[0].high, c[0].low, c[0].rainyDays, c[0].rainMm], [28, 20, 3, 30]);
  assert.equal(c[0].verdict, "best");
  assert.equal(c[6].rainyDays, 30);
  assert.equal(c[6].verdict, "avoid");
});

test("month ranges read naturally, including across the new year", () => {
  assert.equal(monthRanges([10, 11, 12, 1, 2, 3]), "October to March");
  assert.equal(monthRanges([4, 5, 9, 10]), "April to May and September to October");
  assert.equal(monthRanges([7]), "July");
  assert.equal(monthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "all year round");
  assert.equal(slugify("Andaman & Nicobar"), "andaman-nicobar");
});
