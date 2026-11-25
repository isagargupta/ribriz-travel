import { NextResponse } from "next/server";
import { z } from "zod";
import { forYou } from "@/lib/for-you";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { getProfile } from "@/lib/profile";

const Body = z.object({
  viewed: z.array(z.string().max(40)).max(20).default([]),
  saved: z.array(z.string().max(40)).max(50).default([]),
  passport: z.string().regex(/^[A-Z]{2}$/).catch("IN"),
});

/** Personal picks for the home page. Private per visitor, never cached. */
export async function POST(req: Request) {
  if (await rateLimited("fy:" + clientIp(req), 40)) return fail("Too many requests.", 429);
  const parsed = await readJson(req, Body);
  if ("res" in parsed) return parsed.res;
  const owner = await getOwner();
  const [picks, profile] = await Promise.all([forYou(owner, parsed.data), getProfile(owner)]);
  return NextResponse.json(
    { picks, remembered: Object.keys(profile.prefs).length + profile.notes.length },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
