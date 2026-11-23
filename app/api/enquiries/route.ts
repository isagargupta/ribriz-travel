import { NextResponse } from "next/server";
import { createEnquiry } from "@/lib/bookings";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { enquirySchema } from "@/lib/schemas";

/** Questions about a trip and custom-trip requests. */
export async function POST(req: Request) {
  if (rateLimited("enq:" + clientIp(req))) return fail("Too many requests. Please wait a few minutes or call us.", 429);
  const parsed = await readJson(req, enquirySchema);
  if ("res" in parsed) return parsed.res;
  const ref = await createEnquiry(parsed.data);
  return NextResponse.json({ ok: true, ref }, { status: 201 });
}
