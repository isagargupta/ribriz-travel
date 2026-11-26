import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/http";
import { waNumber } from "@/lib/whatsapp-rules";

const Body = z.object({ on: z.boolean(), number: z.string().max(30).optional() });

/** Turn WhatsApp updates on (with the number, recording when they agreed) or off. */
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return fail("Sign in first.", 401);
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return fail("Invalid request.");
  if (!b.data.on) {
    await prisma.customer.update({ where: { id: me.id }, data: { whatsappOptInAt: null } });
    return NextResponse.json({ ok: true, on: false });
  }
  const n = waNumber(b.data.number ?? me.phone);
  if (!n) return fail("Enter a mobile number with country code, e.g. +91 98765 43210.");
  await prisma.customer.update({ where: { id: me.id }, data: { whatsappNumber: n, whatsappOptInAt: new Date() } });
  return NextResponse.json({ ok: true, on: true, number: n });
}
