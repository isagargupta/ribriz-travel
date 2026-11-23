import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EMAIL_RE, PHONE_RE, clean, clientIp, int, rateLimited, shortRef } from "@/lib/validate";

const TYPES = ["hold", "enquiry", "custom"];

export async function POST(req: Request) {
  if (rateLimited("enq:" + clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes or call us." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const type = clean(body.type, 20);
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160).toLowerCase();
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Unknown request type." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!PHONE_RE.test(phone)) return NextResponse.json({ error: "Enter a valid mobile number, for example +91 98765 43210." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  let tripId: string | null = null, tripTitle: string | null = null;
  const tid = clean(body.tripId, 40);
  if (tid) {
    const trip = await prisma.trip.findUnique({ where: { id: tid }, select: { id: true, title: true } });
    if (!trip) return NextResponse.json({ error: "That trip is no longer available." }, { status: 404 });
    tripId = trip.id; tripTitle = trip.title;
  }
  const departure = clean(body.departure, 10);

  const e = await prisma.enquiry.create({
    data: {
      type, name, phone, email, tripId, tripTitle,
      departure: /^\d{4}-\d{2}-\d{2}$/.test(departure) ? departure : null,
      adults: int(body.adults, 1, 9, 2),
      children: int(body.children, 0, 6, 0),
      fromCity: clean(body.fromCity, 40) || null,
      quotedTotal: body.quotedTotal ? int(body.quotedTotal, 0, 100_000_000, 0) : null,
      message: clean(body.message, 2000) || null,
    },
  });
  return NextResponse.json({ ok: true, ref: shortRef(e.id) }, { status: 201 });
}
