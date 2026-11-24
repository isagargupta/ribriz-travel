import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { markFailed } from "@/lib/payments";

/** Checkout reported a failure; the order is marked failed (only if it never succeeded). */
export async function POST(req: Request) {
  if (rateLimited("payfail:" + clientIp(req), 20)) return fail("Too many attempts.", 429);
  const parsed = await readJson(req, z.object({ orderId: z.string().max(60) }));
  if ("res" in parsed) return parsed.res;
  await markFailed(parsed.data.orderId);
  return NextResponse.json({ ok: true });
}
