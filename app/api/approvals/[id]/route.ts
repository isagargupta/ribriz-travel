import { NextResponse, after } from "next/server";
import { decide, pendingCard } from "@/lib/approvals";
import { clientIp, fail, rateLimited } from "@/lib/http";
import { notifyEnquiry, notifyHold } from "@/lib/notify";
import { getOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The approval card's current state (used by the trip hub). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const card = await pendingCard(await getOwner(), (await params).id);
  return card ? NextResponse.json(card, { headers: { "Cache-Control": "private, no-store" } }) : fail("Not found.", 404);
}

/** The traveller approves or declines an action the assistant prepared. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (rateLimited("approve:" + clientIp(req), 20)) return fail("Too many requests. Please wait a moment.", 429);
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid request."); }
  const owner = await getOwner();
  const r = await decide(owner, id, body);
  if (!r.ok) return fail(r.error, 409);
  if (r.status === "done" && r.ref) {
    const ref = r.ref;
    const e = await prisma.enquiry.findUnique({ where: { ref }, select: { type: true } });
    after(() => (e?.type === "hold" ? notifyHold(ref) : notifyEnquiry(ref)));
  }
  return NextResponse.json(r);
}
