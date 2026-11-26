import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Who is signed in, for client components on otherwise static pages. */
export async function GET() {
  const me = await currentCustomer();
  const saved = me ? JSON.parse((await prisma.travellerProfile.findUnique({ where: { customerId: me.id }, select: { saved: true } }))?.saved ?? "[]") as string[] : [];
  return NextResponse.json(me ? { email: me.email, name: me.name, phone: me.phone, saved } : null, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Saves the traveller's hearted trips on their account so every device shows the same list. */
export async function PUT(req: Request) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.saved) ? [...new Set((body.saved as unknown[]).filter((x): x is string => typeof x === "string" && x.length < 40))].slice(0, 100) : null;
  if (!ids) return NextResponse.json({ error: "Invalid list." }, { status: 400 });
  await prisma.travellerProfile.upsert({ where: { customerId: me.id }, create: { customerId: me.id, saved: JSON.stringify(ids) }, update: { saved: JSON.stringify(ids) } });
  return NextResponse.json({ ok: true });
}
