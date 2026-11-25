import { test } from "node:test";
import assert from "node:assert/strict";
import { countryInfo, dayPlan, leavingChecklist, offsetFromIndia, tripClock, weatherLabel } from "../lib/live-rules.ts";

test("trip clock: phases around a 7-night trip leaving 10 March", () => {
  const at = (d: string) => tripClock(d, "2027-03-10", 7);
  assert.equal(at("2027-03-01").phase, "planning");
  assert.equal(at("2027-03-07").phase, "leaving_soon");
  assert.equal(at("2027-03-07").daysToGo, 3);
  assert.deepEqual([at("2027-03-10").phase, at("2027-03-10").day], ["departure_day", 1]);
  assert.deepEqual([at("2027-03-12").phase, at("2027-03-12").day], ["on_trip", 3]);
  assert.deepEqual([at("2027-03-17").phase, at("2027-03-17").day], ["on_trip", 8]); // flight home, day 8 of 8
  assert.equal(at("2027-03-17").totalDays, 8);
  assert.equal(at("2027-03-18").phase, "just_back");
  assert.equal(at("2027-03-21").phase, "past");
});

test("day plan reads today's and tomorrow's lines, and stops at the end", () => {
  const it = ["Arrive", "Temples", "Fly home"];
  assert.deepEqual(dayPlan(it, 2), { today: "Temples", tomorrow: "Fly home" });
  assert.deepEqual(dayPlan(it, 3), { today: "Fly home", tomorrow: null });
  assert.deepEqual(dayPlan(it, null), { today: null, tomorrow: null });
});

test("country info picks the first country we know", () => {
  assert.equal(countryInfo(["XX", "CH", "FR"])?.code, "CH");
  assert.equal(countryInfo(["XX"]), null);
  assert.ok(countryInfo(["TH"])!.emergency.some((e) => e.number === "1155"));
});

test("time difference from India", () => {
  const jan = new Date("2027-01-15T06:00:00Z");
  assert.equal(offsetFromIndia("Asia/Kolkata", jan), "same time as India");
  assert.equal(offsetFromIndia("Asia/Dubai", jan), "1h 30m behind India");
  assert.equal(offsetFromIndia("Asia/Tokyo", jan), "3h 30m ahead of India");
  assert.equal(offsetFromIndia("Asia/Bangkok", jan), "1h 30m ahead of India");
});

test("weather codes and the leaving checklist", () => {
  assert.equal(weatherLabel(0).label, "Clear sky");
  assert.equal(weatherLabel(63).label, "Rain");
  assert.equal(weatherLabel(95).label, "Thunderstorms");
  const dom = leavingChecklist({ visaNeeded: false, hasInsurance: false, hasForex: false, hasFlights: true, international: false });
  assert.ok(!dom.some((i) => i.id === "visa" || i.id === "forex"));
  assert.match(dom[0].text, /Aadhaar/);
  const intl = leavingChecklist({ visaNeeded: true, hasInsurance: true, hasForex: true, hasFlights: true, international: true });
  assert.ok(intl.some((i) => i.id === "visa"));
});
