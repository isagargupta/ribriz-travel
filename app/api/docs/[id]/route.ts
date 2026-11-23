import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteDoc } from "@/lib/documents";
import { getOwnedMission } from "@/lib/missions";
import { getOwner } from "@/lib/owner";
import { signedUrl } from "@/lib/supabase";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Opens a document through a 2-minute signed link. Only its traveller or a signed-in admin. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await prisma.travelDoc.findUnique({ where: { id: (await params).id } });
  if (!d) return fail("Not found.", 404);
  const allowed = (await isAdmin()) || !!(await getOwnedMission(await getOwner(), d.missionId));
  if (!allowed) return fail("Not found.", 404);
  return NextResponse.redirect(await signedUrl(d.fileKey, 120), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return (await deleteDoc(await getOwner(), (await params).id)) ? NextResponse.json({ ok: true }) : fail("Not found.", 404);
}
