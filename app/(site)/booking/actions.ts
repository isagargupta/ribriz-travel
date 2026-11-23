"use server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimited } from "@/lib/http";
import { HOLD_HOURS } from "@/lib/pricing";
import { firstError, lookupSchema } from "@/lib/schemas";

export interface BookingView {
  ref: string; type: string; status: string; tripTitle: string | null; tripSlug: string | null; image: string | null;
  departure: string | null; nights: number | null; adults: number; children: number; fromCity: string | null;
  total: number | null; createdAt: string; holdEndsAt: string | null; name: string;
}

export type LookupState = { error?: string; booking?: BookingView } | undefined;

export async function lookupBooking(_: LookupState, fd: FormData): Promise<LookupState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited("lookup:" + ip, 10)) return { error: "Too many attempts. Please wait a few minutes." };

  const parsed = lookupSchema.safeParse({ ref: fd.get("ref"), email: fd.get("email") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const e = await prisma.enquiry.findUnique({ where: { ref: parsed.data.ref }, include: { trip: { select: { slug: true, image: true, nights: true } } } });
  // same message for "no such ref" and "wrong email" so references can't be probed
  if (!e || e.email !== parsed.data.email) return { error: "We couldn't find a booking with that reference and email. Check both and try again." };

  return {
    booking: {
      ref: e.ref, type: e.type, status: e.status, tripTitle: e.tripTitle, tripSlug: e.trip?.slug ?? null, image: e.trip?.image ?? null,
      departure: e.departure, nights: e.trip?.nights ?? null, adults: e.adults, children: e.children, fromCity: e.fromCity,
      total: e.quotedTotal, createdAt: e.createdAt.toISOString(),
      holdEndsAt: e.type === "hold" ? new Date(e.createdAt.getTime() + HOLD_HOURS * 3600e3).toISOString() : null,
      name: e.name.split(" ")[0],
    },
  };
}
