import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { forgetEverything, getProfile, updateProfile } from "@/lib/profile";
import { PrefsSchema } from "@/lib/profile-rules";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const ALL_KEYS = Object.keys(PrefsSchema.shape) as (keyof typeof PrefsSchema.shape)[];

export async function GET() {
  return NextResponse.json(await getProfile(await getOwner()), noStore);
}

/** The /you editor saves the whole set of preferences, and can add a note. */
const Put = z.object({ prefs: PrefsSchema, note: z.string().max(200).optional() });
export async function PUT(req: Request) {
  if (rateLimited("profile:" + clientIp(req), 30)) return fail("Too many requests.", 429);
  const parsed = await readJson(req, Put);
  if ("res" in parsed) return parsed.res;
  const owner = await getOwner(true);
  const set = Object.fromEntries(ALL_KEYS.map((k) => [k, parsed.data.prefs[k] ?? null]));
  const r = await updateProfile(owner, { set, note: parsed.data.note });
  return NextResponse.json({ ...r.profile, refused: r.refused }, noStore);
}

/** Forget one note (?note=id) or everything. */
export async function DELETE(req: Request) {
  const owner = await getOwner();
  const note = new URL(req.url).searchParams.get("note");
  if (note) return NextResponse.json((await updateProfile(owner, { forgetNote: note })).profile, noStore);
  await forgetEverything(owner);
  return NextResponse.json({ prefs: {}, notes: [], updatedAt: null }, noStore);
}
