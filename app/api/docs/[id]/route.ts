import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteDoc } from "@/lib/documents";
import { getOwnedMission } from "@/lib/missions";
import { getOwner } from "@/lib/owner";
import { downloadPrivate, signedUrl } from "@/lib/supabase";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Opens a document through a 2-minute signed link. Only its traveller or a signed-in admin.
 * With ?raw=1 the bytes come from this site instead, so the traveller's phone can keep
 * a copy offline (the service worker stores it only when they tap "Save offline").
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await prisma.travelDoc.findUnique({ where: { id: (await params).id } });
  if (!d) return fail("Not found.", 404);
  // visa applications: the link from our email (?t=) opens that application's documents too
  const t = new URL(req.url).searchParams.get("t");
  const viaLink = !!t && await (async () => {
    const e = await prisma.enquiry.findFirst({ where: { missionId: d.missionId, type: "visa" }, select: { ref: true } });
    const { payToken } = await import("@/lib/payments");
    const { safeEqual } = await import("@/lib/signing");
    return !!e && safeEqual(t, payToken(e.ref));
  })();
  const allowed = viaLink || (await isAdmin()) || !!(await getOwnedMission(await getOwner(), d.missionId));
  if (!allowed) return fail("Not found.", 404);
  if (new URL(req.url).searchParams.get("raw")) {
    const blob = await downloadPrivate(d.fileKey);
    return new Response(blob.stream(), {
      headers: {
        "Content-Type": d.mime, "Content-Length": String(blob.size), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
        "Content-Disposition": `inline; filename="${d.fileName.replace(/[^\w.\- ]/g, "_")}"`, "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return NextResponse.redirect(await signedUrl(d.fileKey, 120), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return (await deleteDoc(await getOwner(), (await params).id)) ? NextResponse.json({ ok: true }) : fail("Not found.", 404);
}
