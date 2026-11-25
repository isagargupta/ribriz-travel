import { NextResponse } from "next/server";
import { currentCustomerId } from "@/lib/customer";
import { fail } from "@/lib/http";
import { pulse } from "@/lib/pulse";

export const dynamic = "force-dynamic";

/** The dashboard's change fingerprint (see lib/pulse.ts). Tiny and cheap, so the app can ask often. */
export async function GET() {
  const id = await currentCustomerId();
  if (!id) return fail("Sign in first.", 401);
  const v = await pulse(id);
  // short hash so the response stays tiny and doesn't expose timestamps
  const h = (await import("node:crypto")).createHash("sha1").update(v).digest("base64url").slice(0, 16);
  return NextResponse.json({ v: h }, { headers: { "Cache-Control": "private, no-store" } });
}
