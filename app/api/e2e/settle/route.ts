import { NextResponse } from "next/server";
import { settleForTests } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Browser tests only: settle a payment as if Razorpay confirmed it. 404 everywhere else. */
export async function POST(req: Request) {
  if (process.env.E2E !== "1") return new Response("Not found", { status: 404 });
  const { paymentRowId } = await req.json();
  await settleForTests(String(paymentRowId));
  return NextResponse.json({ ok: true });
}
