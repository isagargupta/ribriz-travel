import "server-only";
import { prisma } from "./db";
import { isOptedOut, optIn } from "./agents/optout";
import type { Owner } from "./owner";
import { FROM_CITIES, adultPrice, fmt, fmtDate } from "./pricing";
import { getDepartures, getPublishedTrips } from "./trips";

export class WatchError extends Error {}

/**
 * Watches a trip (or one date of it) for price drops. The daily agent emails
 * when the per-adult price falls by at least ₹1,000 and 2%.
 */
export async function watchPrice(owner: Owner, i: { slug: string; date?: string | null; email?: string | null; from?: string | null }) {
  const email = (i.email || owner.email || "").trim().toLowerCase();
  if (!email) throw new WatchError("Add your email so we can tell you when the price drops.");
  const trip = (await getPublishedTrips()).find((t) => t.slug === i.slug);
  if (!trip) throw new WatchError("Trip not found.");
  const dep = i.date ? (await getDepartures(trip.id)).find((d) => d.date === i.date) : null;
  if (i.date && !dep) throw new WatchError("That date isn't open any more.");
  const from = i.from && i.from in FROM_CITIES ? i.from : "Mumbai";
  const price = adultPrice(trip.price, dep ? dep.priceDelta : trip.minDelta, trip.flight, from);

  // asking for an alert is a clear opt-in, even after an earlier unsubscribe
  if (await isOptedOut(email)) await optIn(email);
  const existing = await prisma.priceWatch.findFirst({ where: { email, tripId: trip.id, departureId: dep?.id ?? null } });
  const data = { lastPrice: price, fromCity: from, active: true, customerId: owner.customerId ?? existing?.customerId ?? null, anonId: owner.anonId ?? existing?.anonId ?? null };
  const w = existing
    ? await prisma.priceWatch.update({ where: { id: existing.id }, data })
    : await prisma.priceWatch.create({ data: { ...data, email, tripId: trip.id, departureId: dep?.id ?? null } });
  return {
    id: w.id, trip: trip.title, price,
    message: `Done. We'll email ${email} if ${dep ? `${fmtDate(dep.date)} on ` : ""}${trip.dest} drops below ${fmt(price)} per adult.`,
  };
}

export async function watchesFor(owner: Owner) {
  if (!owner.customerId && !owner.anonId && !owner.email) return [];
  const or = [owner.customerId && { customerId: owner.customerId }, owner.anonId && { anonId: owner.anonId }, owner.email && { email: owner.email.toLowerCase() }].filter(Boolean) as object[];
  return prisma.priceWatch.findMany({ where: { active: true, OR: or }, orderBy: { createdAt: "desc" }, take: 20 });
}

export async function stopWatch(owner: Owner, id: string) {
  const mine = await watchesFor(owner);
  if (!mine.some((w) => w.id === id)) return false;
  await prisma.priceWatch.update({ where: { id }, data: { active: false } });
  return true;
}
