import "server-only";
import { prisma } from "./db";
import { setEnquiryStatus } from "./bookings";
import { logEvent, setTask } from "./missions";
import { ownsRecord, type Owner } from "./owner";
import { paymentPlan, checkoutSignatureOk, type Plan } from "./payment-rules";
import { HOLD_HOURS, fmt, isoDate } from "./pricing";
import { RazorpayError, capturePayment, createOrder, fetchPayment, refundPayment, rzpConfigured, rzpKeyId, rzpSecret } from "./razorpay";
import { safeEqual, sign } from "./signing";

/**
 * Paying for a trip booking. The server decides every amount from the booking;
 * a payment counts only when Razorpay's signature checks out AND fetching the
 * payment from Razorpay shows it captured for exactly that order and amount.
 */

export class PayError extends Error {}

/** Secret link token for a booking's payment page (sent in emails). */
export const payToken = (ref: string) => sign(`pay:${ref}`).slice(0, 24);
export const payUrl = (ref: string) => `/pay/${ref}?t=${payToken(ref)}`;

async function load(ref: string) {
  return prisma.enquiry.findUnique({
    where: { ref },
    include: { payments: { orderBy: { createdAt: "asc" } }, trip: { select: { title: true, slug: true, image: true, nights: true } }, mission: { select: { id: true, customerId: true, anonId: true } }, dep: { select: { status: true, seatsLeft: true } } },
  });
}
type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

/** Who may pay: anyone with the link from our email, the signed-in customer, or the browser that owns the trip. */
export function mayPay(e: Loaded, token: string | null, owner: Owner) {
  if (token && safeEqual(token, payToken(e.ref))) return true;
  if (owner.customerId && owner.email && owner.email.toLowerCase() === e.email.toLowerCase()) return true;
  return !!e.mission && ownsRecord(owner, e.mission);
}

const paidOf = (e: Loaded) => e.payments.reduce((n, p) => n + (p.status === "paid" || p.status === "partially_refunded" ? p.amount - p.refundedAmount : 0), 0);

/** Holidays can be booked with a deposit; services are paid in full once priced. */
const HOLIDAY_TYPES = ["hold", "custom", "enquiry"];

export function planOf(e: Loaded): Plan {
  const paid = paidOf(e);
  const holdExpired = e.type === "hold" && paid === 0 && e.status !== "booked" && Date.now() - e.createdAt.getTime() > HOLD_HOURS * 3600e3;
  return paymentPlan({ total: e.quotedTotal ?? 0, paid, departure: e.departure, today: isoDate(new Date()), status: e.status, holdExpired, fullOnly: !HOLIDAY_TYPES.includes(e.type) });
}

export interface PayView {
  ref: string; name: string; email: string; phone: string; tripTitle: string | null; tripSlug: string | null; image: string | null;
  departure: string | null; nights: number | null; adults: number; children: number; total: number;
  plan: Plan; payments: { kind: string; amount: number; status: string; paidAt: string | null; method: string | null; refunded: number }[];
  enabled: boolean; missionId: string | null;
  /** hold | custom | flight | hotel | visa | insurance | forex | enquiry */
  type: string;
}

export async function payView(ref: string, token: string | null, owner: Owner): Promise<PayView | null> {
  const e = await load(ref);
  if (!e || !mayPay(e, token, owner)) return null;
  return {
    ref: e.ref, name: e.name, email: e.email, phone: e.phone, tripTitle: e.trip?.title ?? e.tripTitle, tripSlug: e.trip?.slug ?? null, image: e.trip?.image ?? null,
    departure: e.departure, nights: e.trip?.nights ?? null, adults: e.adults, children: e.children, total: e.quotedTotal ?? 0,
    plan: planOf(e), enabled: rzpConfigured(), missionId: e.mission?.id ?? null, type: e.type,
    payments: e.payments.filter((p) => p.status !== "created").map((p) => ({ kind: p.kind, amount: p.amount, status: p.status, paidAt: p.paidAt?.toISOString() ?? null, method: p.method, refunded: p.refundedAmount })),
  };
}

/** Creates a Razorpay order for whatever is due next. */
export async function startPayment(ref: string, token: string | null, owner: Owner) {
  const e = await load(ref);
  if (!e || !mayPay(e, token, owner)) throw new PayError("We couldn't find that booking.");
  if (!rzpConfigured()) throw new PayError("Online payment isn't switched on yet. Reply to your confirmation email and we'll help.");
  const plan = planOf(e);
  if (!plan.next) {
    throw new PayError(plan.blocked === "hold_expired" ? "This price hold has ended. Ask Riya to hold today's price again, then pay." : plan.blocked === "departed" ? "This trip has already started." : plan.blocked === "closed" ? "This booking is closed." : "Nothing is due right now.");
  }
  // seats can sell out between holding and paying
  if (plan.paid === 0 && e.dep && (e.dep.status !== "open" || (e.dep.seatsLeft !== null && e.dep.seatsLeft < e.adults + e.children))) {
    throw new PayError("Sorry, this date is no longer available. Ask Riya for the nearest dates.");
  }
  const order = await createOrder(plan.next.amount, `${e.ref}-${plan.next.kind}`, { ref: e.ref, kind: plan.next.kind });
  await prisma.payment.create({ data: { enquiryId: e.id, kind: plan.next.kind, amount: plan.next.amount, orderId: order.id } });
  return {
    keyId: rzpKeyId(), orderId: order.id, amountPaise: order.amount, kind: plan.next.kind, amount: plan.next.amount,
    description: `${e.trip?.title ?? e.tripTitle ?? "Your trip"} · ${plan.next.kind === "deposit" ? "deposit" : plan.next.kind === "balance" ? "balance" : "full payment"} · ${e.ref}`,
    prefill: { name: e.name, email: e.email, contact: e.phone },
  };
}

/**
 * Marks a payment paid after checking it with Razorpay. Safe to call more than
 * once (browser and webhook both call it): only the first call has effects.
 */
async function settle(orderId: string, paymentId: string) {
  const pay = await prisma.payment.findUnique({ where: { orderId }, include: { enquiry: true } });
  if (!pay) throw new PayError("Unknown order.");
  if (pay.status === "paid") return { already: true, pay };
  let p;
  try { p = await fetchPayment(paymentId); } catch { throw new PayError("We couldn't confirm this payment with Razorpay yet. If money left your account, it will show here within a few minutes, or ask Riya (the chat button) to send it to our team with your booking reference."); }
  if (p.order_id !== orderId || p.currency !== "INR" || p.amount !== pay.amount * 100) throw new PayError("Payment details don't match this order.");
  if (p.status === "authorized") p = await capturePayment(p.id, p.amount);
  if (p.status !== "captured") throw new PayError(p.status === "failed" ? "The payment failed. Nothing was charged; please try again." : "The payment isn't complete yet.");
  const claimed = await prisma.payment.updateMany({ where: { id: pay.id, status: { in: ["created", "failed"] } }, data: { status: "paid", paymentId: p.id, method: p.method ?? null, paidAt: new Date() } });
  if (claimed.count !== 1) return { already: true, pay };
  await afterPaid(pay.enquiry.id, pay.kind, pay.amount);
  return { already: false, pay };
}

/** Browser handler: verify Razorpay's checkout signature, then settle. */
export async function confirmFromCheckout(orderId: string, paymentId: string, signature: string) {
  if (!checkoutSignatureOk(orderId, paymentId, signature, rzpSecret())) throw new PayError("We couldn't verify this payment. If money left your account, ask Riya (the chat button) to send it to our team with your booking reference and we'll sort it out quickly.");
  return settle(orderId, paymentId);
}
export const confirmFromWebhook = settle;

export async function markFailed(orderId: string) {
  await prisma.payment.updateMany({ where: { orderId, status: "created" }, data: { status: "failed" } });
}

async function afterPaid(enquiryId: string, kind: string, amount: number) {
  const e = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId }, include: { payments: true } });
  const paid = e.payments.reduce((n, p) => n + (p.status === "paid" || p.status === "partially_refunded" ? p.amount - p.refundedAmount : 0), 0);
  const full = paid >= (e.quotedTotal ?? 0);
  if (!HOLIDAY_TYPES.includes(e.type)) {
    // a service (flight, hotel, visa, insurance, forex): paid, and now the team books it with the supplier
    if (e.status === "new") await setEnquiryStatus(e.id, "contacted", `Paid in full online (${fmt(amount)}). Book it now.`);
    if (e.missionId) {
      const { OFFER_TASK } = await import("./offers");
      const task = OFFER_TASK[e.type];
      if (task) await setTask(e.missionId, task, { status: "waiting", note: `Paid ${fmt(paid)}. Our team is booking it now; the confirmation will appear here.` });
      await logEvent(e.missionId, "traveller", `Paid ${fmt(amount)} online for ${e.tripTitle ?? e.type}.`);
    }
    const { notifyPayment } = await import("./notify");
    await notifyPayment(e.id, amount, kind).catch((err) => console.error("payment email failed", err));
    return;
  }
  if (e.status !== "booked") await setEnquiryStatus(e.id, "booked", `${kind === "full" ? "Paid in full" : "Deposit paid"} online (${fmt(amount)}).`);
  if (e.missionId) {
    await setTask(e.missionId, "price_hold", { status: "done", note: full ? `Booked and paid in full (${fmt(paid)}). Ref ${e.ref}.` : `Booked! Deposit ${fmt(amount)} paid. Balance ${fmt((e.quotedTotal ?? 0) - paid)} due 30 days before you leave. Ref ${e.ref}.` });
    await logEvent(e.missionId, "traveller", `Paid ${fmt(amount)} (${kind}) online. ${full ? "Fully paid." : "Trip booked."}`);
  }
  const { notifyPayment } = await import("./notify");
  await notifyPayment(e.id, amount, kind).catch((err) => console.error("payment email failed", err));
}

/** Admin: refund all or part of a payment through Razorpay. */
export async function refund(paymentRowId: string, rupees: number, reason: string) {
  const pay = await prisma.payment.findUnique({ where: { id: paymentRowId } });
  if (!pay?.paymentId || (pay.status !== "paid" && pay.status !== "partially_refunded")) throw new PayError("Only completed payments can be refunded.");
  const left = pay.amount - pay.refundedAmount;
  const amt = Math.min(Math.max(1, Math.round(rupees)), left);
  await refundPayment(pay.paymentId, amt, { reason: reason.slice(0, 200) });
  const refunded = pay.refundedAmount + amt;
  await prisma.payment.update({ where: { id: pay.id }, data: { refundedAmount: refunded, status: refunded >= pay.amount ? "refunded" : "partially_refunded" } });
  return { refunded: amt, left: left - amt };
}

export { RazorpayError };
