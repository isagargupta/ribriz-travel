import { test } from "node:test";
import assert from "node:assert/strict";
import { waNumber, waParam } from "../lib/whatsapp-rules.ts";

test("phone numbers become WhatsApp numbers", () => {
  assert.equal(waNumber("98765 43210"), "919876543210");
  assert.equal(waNumber("+91 98765-43210"), "919876543210");
  assert.equal(waNumber("09876543210"), "919876543210");
  assert.equal(waNumber("+48 512 345 678"), "48512345678");
  assert.equal(waNumber("12345"), null);
  assert.equal(waNumber("+91 12345 67890"), null); // not a mobile
  assert.equal(waNumber(""), null);
});

test("template parameters have no line breaks", () => {
  assert.equal(waParam("Paid ₹5,000.\nReceipt in your wallet.\t"), "Paid ₹5,000. Receipt in your wallet.");
});
