import { NextResponse } from "next/server";
import { getOwnedMission } from "@/lib/missions";
import { getOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

/** The visitor's most recent open trip, so the chat knows where an upload belongs. */
export async function GET() {
  const m = await getOwnedMission(await getOwner(), null);
  return NextResponse.json(m ? { id: m.id, title: m.title } : null, { headers: { "Cache-Control": "private, no-store" } });
}
