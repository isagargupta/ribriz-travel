// What a traveller owes next, and how we check Razorpay's signatures.
// Pure (no server imports), so it's unit-tested.
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEPOSIT_RATE = 0.1;
export const MIN_DEPOSIT = 5000;
/** The balance is due this many days before departure; inside it, the full amount is due at once. */
export const BALANCE_DAYS = 30;
const DAY = 864e5;
const parse = (d: string) => Date.parse(d + "T00:00:00Z");

export interface PlanInput {
  total: number;
  paid: number;
  /** YYYY-MM-DD */
  departure: string | null;
  today: string;
  status: string;
  /** a hold that hasn't been paid and is past 48 hours */
  holdExpired: boolean;
  /** services (flights, hotels, visa, insurance, forex) are paid in full, not by deposit */
  fullOnly?: boolean;
}
export interface Plan {
  next: { kind: "deposit" | "balance" | "full"; amount: number } | null;
  paid: number;
  balance: number;
  /** YYYY-MM-DD the balance is due */
  balanceDue: string | null;
  /** why nothing can be paid right now */
  blocked?: "hold_expired" | "closed" | "departed" | "no_total";
}

export function paymentPlan(p: PlanInput): Plan {
  const balance = Math.max(0, p.total - p.paid);
  const balanceDue = p.departure ? new Date(parse(p.departure) - BALANCE_DAYS * DAY).toISOString().slice(0, 10) : null;
  const base = { paid: p.paid, balance, balanceDue };
  if (!p.total) return { ...base, next: null, blocked: "no_total" };
  if (p.status === "closed") return { ...base, next: null, blocked: "closed" };
  if (balance === 0) return { ...base, next: null };
  if (p.departure && p.departure <= p.today) return { ...base, next: null, blocked: "departed" };
  if (p.paid === 0) {
    if (p.holdExpired) return { ...base, next: null, blocked: "hold_expired" };
    const late = p.fullOnly || (!!balanceDue && balanceDue <= p.today);
    if (late) return { ...base, next: { kind: "full", amount: balance } };
    return { ...base, next: { kind: "deposit", amount: Math.min(balance, Math.max(MIN_DEPOSIT, Math.round(p.total * DEPOSIT_RATE))) } };
  }
  return { ...base, next: { kind: "balance", amount: balance } };
}

const eqHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Razorpay Checkout signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function checkoutSignatureOk(orderId: string, paymentId: string, signature: string, secret: string) {
  const want = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return eqHex(want, signature);
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function webhookSignatureOk(rawBody: string, signature: string, secret: string) {
  const want = createHmac("sha256", secret).update(rawBody).digest("hex");
  return eqHex(want, signature);
}

/**
 * Splitting a holiday between the travellers: one person's share is the total
 * divided by the number of travellers (rounded up to the rupee), never more
 * than what's left to pay.
 */
export function shareAmount(total: number, paid: number, travellers: number): number {
  const balance = Math.max(0, total - paid);
  return Math.min(balance, Math.ceil(total / Math.max(1, travellers)));
}
