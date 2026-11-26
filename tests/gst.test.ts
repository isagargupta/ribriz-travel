import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords, checkGstin, docNumber, financialYear, inr, placeOfSupply, splitTax } from "../lib/gst-rules.ts";

test("GSTIN: Ribriz's own passes; typos, bad states and bad shapes fail", () => {
  const ok = checkGstin(" 29aancr5772q1z6 ");
  assert.deepEqual(ok, { ok: true, gstin: "29AANCR5772Q1Z6", stateCode: "29" });
  assert.equal(checkGstin("29AANCR5772Q1Z7").ok, false); // wrong check digit
  assert.equal(checkGstin("99AANCR5772Q1Z6").ok, false); // no such state
  assert.equal(checkGstin("29AANCR5772").ok, false);
});

test("financial year turns over on 1 April, India time", () => {
  assert.equal(financialYear(new Date("2026-11-26T10:00:00Z")), "2026-27");
  assert.equal(financialYear(new Date("2027-03-31T19:00:00Z")), "2027-28"); // already 1 April in India
  assert.equal(financialYear(new Date("2027-03-31T10:00:00Z")), "2026-27");
});

test("document numbers fit GST's 16-character limit", () => {
  assert.equal(docNumber("invoice", "2026-27", 7), "RB/2026-27/0007");
  assert.equal(docNumber("credit_note", "2026-27", 12345), "CN/2026-27/12345");
  assert.ok(docNumber("credit_note", "2026-27", 99999).length <= 16);
  assert.equal(docNumber("receipt_voucher", "2026-27", 3), "RV/2026-27/0003");
  assert.equal(docNumber("refund_voucher", "2026-27", 1), "RF/2026-27/0001");
});

test("tax split: 5% inclusive, CGST+SGST within Karnataka, IGST across states, always adds up", () => {
  const a = splitTax(11781000, 5, true); // ₹1,17,810
  assert.equal(a.taxable, 11220000);
  assert.equal(a.cgst + a.sgst, 561000);
  assert.equal(a.taxable + a.cgst + a.sgst, a.total);
  const b = splitTax(100001, 5, false);
  assert.equal(b.cgst + b.sgst, 0);
  assert.equal(b.taxable + b.igst, 100001);
});

test("place of supply follows a business buyer's GSTIN, else Karnataka", () => {
  assert.deepEqual(placeOfSupply("29", null), { code: "29", name: "Karnataka" });
  assert.equal(placeOfSupply("29", "27AAPFU0939F1ZV").code, "27");
  assert.equal(placeOfSupply("29", "garbage").code, "29");
});

test("amount in words, Indian grouping", () => {
  assert.equal(amountInWords(11781050), "Rupees One Lakh Seventeen Thousand Eight Hundred Ten and Fifty Paise Only");
  assert.equal(amountInWords(1250000000), "Rupees One Crore Twenty Five Lakh Only");
  assert.equal(amountInWords(0), "Rupees Zero Only");
  assert.equal(inr(11781050), "₹1,17,810.50");
});
