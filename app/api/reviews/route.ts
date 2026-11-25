import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { ReviewError, ReviewInput, submitReview } from "@/lib/reviews";

/** A signed-in traveller reviews a trip they took. Goes to the team to publish. */
export async function POST(req: Request) {
  if (await rateLimited("review:" + clientIp(req), 10)) return fail("Too many requests.", 429);
  const me = await currentCustomer();
  if (!me) return fail("Please sign in to review your trip.", 401);
  const parsed = await readJson(req, ReviewInput);
  if ("res" in parsed) return parsed.res;
  try {
    await submitReview(me.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, 403);
    throw e;
  }
}
