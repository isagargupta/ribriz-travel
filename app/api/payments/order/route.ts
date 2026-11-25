import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { PayError, RazorpayError, startPayment } from "@/lib/payments";

const Body = z.object({ ref: z.string().regex(/^RB-[A-Z0-9]{4,12}$/), t: z.string().max(64).nullish() });

/** Creates a Razorpay order for what's due next on a booking. The amount is decided here, not by the browser. */
export async function POST(req: Request) {
  if (await rateLimited("payorder:" + clientIp(req), 12)) return fail("Too many attempts. Please wait a minute.", 429);
  const parsed = await readJson(req, Body);
  if ("res" in parsed) return parsed.res;
  try {
    return NextResponse.json({ ok: true, ...(await startPayment(parsed.data.ref, parsed.data.t ?? null, await getOwner())) });
  } catch (e) {
    if (e instanceof PayError || e instanceof RazorpayError) return fail(e.message, 409);
    throw e;
  }
}
