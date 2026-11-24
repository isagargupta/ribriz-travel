import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookSignatureOk } from "@/lib/payment-rules";
import { confirmFromWebhook, markFailed } from "@/lib/payments";
import { fetchPayment, rzpWebhookSecret } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (Dashboard → Webhooks → https://www.ribriztravel.com/api/payments/webhook,
 * events payment.captured, payment.failed, refund.processed). Backs up the browser
 * handler, e.g. when a customer closes the window right after paying.
 */
export async function POST(req: Request) {
  const secret = rzpWebhookSecret();
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (!webhookSignatureOk(raw, req.headers.get("x-razorpay-signature") ?? "", secret)) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  const evt = JSON.parse(raw) as { event: string; payload: { payment?: { entity: { id: string; order_id: string } }; refund?: { entity: { payment_id: string; amount: number } } } };
  try {
    const pay = evt.payload.payment?.entity;
    if (evt.event === "payment.captured" && pay?.order_id) await confirmFromWebhook(pay.order_id, pay.id);
    else if (evt.event === "payment.failed" && pay?.order_id) await markFailed(pay.order_id);
    else if (evt.event === "refund.processed" && evt.payload.refund) {
      // refunds made in the Razorpay dashboard are recorded too: read the true refunded total from Razorpay
      const row = await prisma.payment.findUnique({ where: { paymentId: evt.payload.refund.entity.payment_id } });
      if (row) {
        const p = await fetchPayment(row.paymentId!);
        const refunded = Math.round((p.amount_refunded ?? 0) / 100);
        await prisma.payment.update({ where: { id: row.id }, data: { refundedAmount: refunded, status: refunded >= row.amount ? "refunded" : refunded > 0 ? "partially_refunded" : row.status } });
      }
    }
  } catch (e) {
    console.error("razorpay webhook", evt.event, (e as Error).message);
    // 200 anyway for unknown orders so Razorpay doesn't retry forever; real errors are logged
  }
  return NextResponse.json({ ok: true });
}
