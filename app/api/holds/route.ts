import { NextResponse, after } from "next/server";
import { notifyHold } from "@/lib/notify";
import { createHold } from "@/lib/bookings";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { holdSchema } from "@/lib/schemas";
import { payUrl } from "@/lib/payments";

/** 48-hour price hold on a specific departure. The server re-prices before saving. */
export async function POST(req: Request) {
  if (rateLimited("hold:" + clientIp(req))) return fail("Too many requests. Please wait a few minutes and try again.", 429);
  const parsed = await readJson(req, holdSchema);
  if ("res" in parsed) return parsed.res;
  const r = await createHold(parsed.data);
  if (!r.ok) return fail(r.message, r.code === "price_changed" ? 409 : 410, { code: r.code, total: r.total });
  after(() => notifyHold(r.ref)); // emails go out after the customer has their answer
  return NextResponse.json({ ...r, payPath: payUrl(r.ref) }, { status: 201 });
}
