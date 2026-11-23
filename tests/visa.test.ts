import { test } from "node:test";
import assert from "node:assert/strict";
import { countryName, flag, isEasy, parseRequirement, visaLine } from "../lib/visa.ts";

test("parses every value the dataset uses", () => {
  assert.deepEqual(parseRequirement("60"), { category: "visa_free", days: 60 });
  assert.deepEqual(parseRequirement("visa free"), { category: "visa_free", days: null });
  assert.deepEqual(parseRequirement("visa on arrival"), { category: "voa", days: null });
  assert.deepEqual(parseRequirement("eta"), { category: "eta", days: null });
  assert.deepEqual(parseRequirement("e-visa"), { category: "evisa", days: null });
  assert.deepEqual(parseRequirement("visa required"), { category: "required", days: null });
  assert.deepEqual(parseRequirement("-1"), { category: "own", days: null });
  assert.equal(parseRequirement("covid ban").category, "no_entry");
  assert.equal(parseRequirement(" Visa Required ").category, "required");
});

test("easy visa = no embassy visit", () => {
  assert.ok(isEasy("visa_free") && isEasy("voa") && isEasy("eta") && isEasy("evisa"));
  assert.ok(!isEasy("required") && !isEasy("no_entry"));
});

test("labels, names and flags", () => {
  assert.equal(visaLine({ c: "visa_free", days: 60 }), "Visa-free · up to 60 days");
  assert.equal(visaLine({ c: "evisa", days: null }), "e-Visa");
  assert.equal(countryName("TH"), "Thailand");
  assert.equal(flag("IN"), "🇮🇳");
});

import { PROCESSING_DAYS, visaReadyWithin } from "../lib/visa.ts";
test("visa ready in time", () => {
  assert.ok(visaReadyWithin(["visa_free", "voa"], 0));
  assert.ok(visaReadyWithin(["eta"], 2) && !visaReadyWithin(["eta"], 1));
  assert.ok(!visaReadyWithin(["evisa", "voa"], 3) && visaReadyWithin(["evisa"], 5));
  assert.ok(!visaReadyWithin(["required"], 7));
  assert.equal(PROCESSING_DAYS.own, 0);
});
