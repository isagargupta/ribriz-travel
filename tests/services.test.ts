import { test } from "node:test";
import assert from "node:assert/strict";
import { completeDetails, detailLines } from "../lib/service-fields.ts";

test("trip facts fill the request; the traveller's words win; defaults apply", () => {
  const r = completeDetails("flight", { from: "Delhi", travellers: "" }, { from: "Mumbai", to: "Tokyo", depart_date: "30 Nov 2026", travellers: "2 adults" });
  assert.equal(r.details.from, "Delhi");
  assert.equal(r.details.to, "Tokyo");
  assert.equal(r.details.travellers, "2 adults"); // blank given value doesn't wipe a known one
  assert.equal(r.details.cabin, "Economy");
  assert.deepEqual(r.missing, []);
});

test("missing required fields are reported; extra keys are kept but don't count", () => {
  const r = completeDetails("forex", { currency: "JPY", note: "half in cash" });
  assert.deepEqual(r.missing.map((m) => m.key), ["amount", "form", "delivery_city"]);
  assert.equal(r.details.note, "half in cash");
});

test("detail lines follow field order with labels", () => {
  assert.deepEqual(detailLines("hotel", { guests: "2 adults", city: "Kyoto", extra_bed: "yes" }), ["City: Kyoto", "Guests: 2 adults", "extra bed: yes"]);
});
