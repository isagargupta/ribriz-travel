import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { PayError, RazorpayError, confirmFromCheckout } from "@/lib/payments";

const Body = z.object({ razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(200) });

/** Razorpay Checkout's success handler posts here; we verify the signature and the payment itself. */
export async function POST(req: Request) {
  if (await rateLimited("payverify:" + clientIp(req), 20)) return fail("Too many attempts.", 429);
  const parsed = await readJson(req, Body);
  if ("res" in parsed) return parsed.res;
  try {
    const r = await confirmFromCheckout(parsed.data.razorpay_order_id, parsed.data.razorpay_payment_id, parsed.data.razorpay_signature);
    return NextResponse.json({ ok: true, ref: r.pay.enquiry.ref });
  } catch (e) {
    if (e instanceof PayError || e instanceof RazorpayError) return fail(e.message, 409);
    throw e;
  }
}
