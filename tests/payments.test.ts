import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkoutSignatureOk, paymentPlan, webhookSignatureOk } from "../lib/payment-rules.ts";

const base = { total: 200000, paid: 0, departure: "2027-03-01", today: "2026-12-01", status: "new", holdExpired: false };

test("first payment is a 10% deposit (minimum ₹5,000), balance due 30 days before", () => {
  const p = paymentPlan(base);
  assert.deepEqual(p.next, { kind: "deposit", amount: 20000 });
  assert.equal(p.balanceDue, "2027-01-30");
  assert.equal(paymentPlan({ ...base, total: 30000 }).next?.amount, 5000);
  assert.equal(paymentPlan({ ...base, total: 3000 }).next?.amount, 3000); // never more than the total
});

test("inside 30 days the full amount is due; then the balance; then nothing", () => {
  assert.deepEqual(paymentPlan({ ...base, departure: "2026-12-20" }).next, { kind: "full", amount: 200000 });
  assert.deepEqual(paymentPlan({ ...base, paid: 20000, status: "booked" }).next, { kind: "balance", amount: 180000 });
  assert.equal(paymentPlan({ ...base, paid: 200000, status: "booked" }).next, null);
});

test("nothing to pay on expired holds, closed or departed trips", () => {
  assert.equal(paymentPlan({ ...base, holdExpired: true }).blocked, "hold_expired");
  assert.equal(paymentPlan({ ...base, status: "closed" }).blocked, "closed");
  assert.equal(paymentPlan({ ...base, paid: 20000, departure: "2026-11-30" }).blocked, "departed");
  // an expired hold doesn't block the balance once a deposit is in
  assert.equal(paymentPlan({ ...base, paid: 20000, holdExpired: true, status: "booked" }).next?.kind, "balance");
});

test("signatures: genuine passes, tampered fails", () => {
  const secret = "s3cret";
  const sig = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.ok(checkoutSignatureOk("order_1", "pay_1", sig, secret));
  assert.ok(!checkoutSignatureOk("order_1", "pay_2", sig, secret));
  assert.ok(!checkoutSignatureOk("order_1", "pay_1", "bad", secret));
  const body = '{"event":"payment.captured"}';
  assert.ok(webhookSignatureOk(body, createHmac("sha256", "wh").update(body).digest("hex"), "wh"));
  assert.ok(!webhookSignatureOk(body + " ", createHmac("sha256", "wh").update(body).digest("hex"), "wh"));
});

test("services are paid in full once priced, even far from departure", async () => {
  const { paymentPlan } = await import("../lib/payment-rules.ts");
  const p = paymentPlan({ total: 42000, paid: 0, departure: "2027-06-01", today: "2026-11-26", status: "contacted", holdExpired: false, fullOnly: true });
  assert.deepEqual(p.next, { kind: "full", amount: 42000 });
  const noDate = paymentPlan({ total: 9000, paid: 0, departure: null, today: "2026-11-26", status: "new", holdExpired: false, fullOnly: true });
  assert.deepEqual(noDate.next, { kind: "full", amount: 9000 });
});

test("a share is the total split by travellers, capped at what's left", async () => {
  const { shareAmount } = await import("../lib/payment-rules.ts");
  assert.equal(shareAmount(100000, 0, 3), 33334);
  assert.equal(shareAmount(100000, 66668, 3), 33332); // the last share is whatever remains
  assert.equal(shareAmount(100000, 100000, 3), 0);
  assert.equal(shareAmount(50000, 0, 0), 50000);
});
