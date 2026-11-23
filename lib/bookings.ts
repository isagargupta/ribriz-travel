import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "./db";
import { isoDate, quote } from "./pricing";
import type { enquirySchema, holdSchema } from "./schemas";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L

export function newRef() {
  let s = "RB-";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Retries on the (very unlikely) chance of a duplicate reference. */
export async function withRef<T>(create: (ref: string) => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await create(newRef());
    } catch (e) {
      const dup = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!dup || i >= 4) throw e;
    }
  }
}

export type HoldResult =
  | { ok: true; ref: string; total: number }
  | { ok: false; code: "not_found" | "closed" | "sold_out" | "price_changed"; message: string; total?: number };

/** Validates availability, re-prices on the server and records a 48-hour price hold. */
export async function createHold(input: z.infer<typeof holdSchema>): Promise<HoldResult> {
  const dep = await prisma.departure.findUnique({ where: { id: input.departureId }, include: { trip: true } });
  if (!dep || !dep.trip.published) return { ok: false, code: "not_found", message: "That departure is no longer available. Please pick another date." };
  if (dep.status !== "open" || dep.date < isoDate(new Date())) return { ok: false, code: "closed", message: "Bookings for this date have closed. Please pick another date." };

  const party = input.adults + input.childAges.length;
  if (dep.seatsLeft !== null && dep.seatsLeft < party)
    return { ok: false, code: "sold_out", message: dep.seatsLeft > 0 ? `Only ${dep.seatsLeft} seat${dep.seatsLeft > 1 ? "s" : ""} left on this date. Choose fewer travellers or another date.` : "This date is sold out. Please pick another date." };

  const q = quote({ base: dep.trip.price, delta: dep.priceDelta, flight: dep.trip.flight, from: input.from, adults: input.adults, childAges: input.childAges });
  // allow ₹1 per traveller of rounding difference; anything else means the price moved
  if (Math.abs(q.total - input.expectedTotal) > party)
    return { ok: false, code: "price_changed", total: q.total, message: "The price for this date has just changed. Please check the new total and confirm again." };

  const e = await withRef((ref) => prisma.enquiry.create({
    data: {
      ref, type: "hold",
      name: input.name, phone: input.phone, email: input.email,
      tripId: dep.tripId, tripTitle: dep.trip.title, departureId: dep.id, departure: dep.date,
      adults: input.adults, children: input.childAges.length, childAges: JSON.stringify(input.childAges),
      travellers: input.travellers.filter(Boolean).length ? JSON.stringify(input.travellers.filter(Boolean)) : null,
      fromCity: input.from, quotedTotal: q.total, message: input.message || null,
    },
  }));
  return { ok: true, ref: e.ref, total: q.total };
}

export async function createEnquiry(input: z.infer<typeof enquirySchema>) {
  let tripTitle: string | null = null, tripId: string | null = null, departure: string | null = null, departureId: string | null = null;
  if (input.tripId) {
    const t = await prisma.trip.findUnique({ where: { id: input.tripId }, select: { id: true, title: true } });
    if (t) { tripId = t.id; tripTitle = t.title; }
  }
  if (input.departureId && tripId) {
    const d = await prisma.departure.findFirst({ where: { id: input.departureId, tripId }, select: { id: true, date: true } });
    if (d) { departureId = d.id; departure = d.date; }
  }
  const e = await withRef((ref) => prisma.enquiry.create({
    data: {
      ref, type: input.type, name: input.name, phone: input.phone, email: input.email,
      tripId, tripTitle, departureId, departure,
      adults: input.adults, children: input.childAges.length, childAges: JSON.stringify(input.childAges),
      fromCity: input.from, message: input.message || null,
    },
  }));
  return e.ref;
}

/**
 * Status change with seat accounting: marking a hold as booked takes seats
 * from its departure; moving it away from booked gives them back.
 */
export async function setEnquiryStatus(id: string, status: string, note: string | null) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.enquiry.findUnique({ where: { id } });
    if (!e) return;
    const party = e.adults + e.children;
    // only price holds reserve seats; service requests (forex, insurance…) just reference the trip
    if (e.type === "hold" && e.departureId && e.status !== status) {
      const dep = await tx.departure.findUnique({ where: { id: e.departureId } });
      if (dep && dep.seatsLeft !== null) {
        if (status === "booked") await tx.departure.update({ where: { id: dep.id }, data: { seatsLeft: Math.max(0, dep.seatsLeft - party) } });
        else if (e.status === "booked") await tx.departure.update({ where: { id: dep.id }, data: { seatsLeft: dep.seatsLeft + party } });
      }
    }
    await tx.enquiry.update({ where: { id }, data: { status, note } });
  });
}
