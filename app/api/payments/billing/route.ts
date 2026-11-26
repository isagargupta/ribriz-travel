import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { PayError, setBilling } from "@/lib/payments";

const Body = z.object({
  ref: z.string().regex(/^RB-[A-Z0-9]{4,12}$/), t: z.string().max(64).nullish(),
  name: z.string().max(120).default(""), gstin: z.string().max(20).default(""), address: z.string().max(300).default(""),
});

/** Saves company GST details for the booking's tax invoice. */
export async function POST(req: Request) {
  if (await rateLimited("billing:" + clientIp(req), 20)) return fail("Too many attempts. Please wait a minute.", 429);
  const parsed = await readJson(req, Body);
  if ("res" in parsed) return parsed.res;
  const d = parsed.data;
  try {
    return NextResponse.json({ ok: true, ...(await setBilling(d.ref, d.t ?? null, await getOwner(), d)) });
  } catch (e) {
    if (e instanceof PayError) return fail(e.message, 400);
    throw e;
  }
}
