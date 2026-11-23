import "server-only";
import { unstable_cache } from "next/cache";
import type { Departure, Trip } from "@prisma/client";
import { prisma } from "./db";
import { isoDate } from "./pricing";
import type { DepartureDTO, Kind, TripDTO, TripIndexItem } from "./types";

/** Cache tag cleared whenever trips or departures change in the admin. */
export const TRIPS_TAG = "trips";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const today = () => isoDate(new Date());

function toDTO(t: Trip & { departures: Departure[] }): TripDTO {
  const deps = t.departures; // already filtered to upcoming + open, sorted by date
  let cheapest: Departure | null = null;
  for (const d of deps) if (!cheapest || d.priceDelta < cheapest.priceDelta) cheapest = d;
  return {
    id: t.id, slug: t.slug, title: t.title, dest: t.dest, country: t.country, region: t.region,
    kind: t.kind as Kind,
    themes: t.themes.split(",").map((x) => x.trim()).filter(Boolean),
    nights: t.nights, stars: t.stars, board: t.board, price: t.price, was: t.was,
    rating: t.rating, reviews: t.reviews, beach: t.beach,
    flight: t.flight, freeCancel: t.freeCancel, tourManager: t.tourManager, easyVisa: t.easyVisa,
    lastMinute: t.lastMinute, earlyBird: t.earlyBird, featured: t.featured,
    image: t.image, highlights: lines(t.highlights), days: lines(t.days),
    countryCodes: t.countryCodes.split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    visaNote: t.visaNote,
    minDelta: cheapest?.priceDelta ?? 0,
    cheapestDate: cheapest?.date ?? null,
    depDates: deps.map((d) => d.date),
  };
}

const upcoming = () => ({ where: { status: "open", date: { gte: today() }, OR: [{ seatsLeft: null }, { seatsLeft: { gt: 0 } }] }, orderBy: { date: "asc" as const } });

/** All trips on sale. Cached for an hour and refreshed instantly when the admin saves. */
export const getPublishedTrips = unstable_cache(
  async (): Promise<TripDTO[]> => {
    const rows = await prisma.trip.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      include: { departures: upcoming() },
    });
    return rows.map(toDTO);
  },
  ["published-trips"],
  { tags: [TRIPS_TAG], revalidate: 3600 },
);

export async function getTripBySlug(slug: string): Promise<{ trip: TripDTO; departures: DepartureDTO[] } | null> {
  const all = await getPublishedTrips();
  const trip = all.find((t) => t.slug === slug);
  if (!trip) return null;
  const departures = await getDepartures(trip.id);
  return { trip, departures };
}

export const getDepartures = unstable_cache(
  async (tripId: string): Promise<DepartureDTO[]> => {
    const rows = await prisma.departure.findMany({ where: { tripId, ...upcoming().where }, orderBy: { date: "asc" } });
    return rows.map((d) => ({ id: d.id, date: d.date, priceDelta: d.priceDelta, seatsLeft: d.seatsLeft }));
  },
  ["trip-departures"],
  { tags: [TRIPS_TAG], revalidate: 3600 },
);

export interface CalendarDay { date: string; options: { base: number; flight: boolean }[] }

/** Departures in the next `days` days grouped by date, for the home page price calendar. */
export const getCalendar = unstable_cache(
  async (days = 14): Promise<CalendarDay[]> => {
    const start = today();
    const end = isoDate(new Date(Date.now() + days * 864e5));
    const rows = await prisma.departure.findMany({
      where: { status: "open", date: { gte: start, lt: end }, trip: { published: true }, OR: [{ seatsLeft: null }, { seatsLeft: { gt: 0 } }] },
      select: { date: true, priceDelta: true, trip: { select: { price: true, flight: true } } },
    });
    const map = new Map<string, CalendarDay>();
    for (let i = 0; i < days; i++) {
      const d = isoDate(new Date(Date.now() + i * 864e5));
      map.set(d, { date: d, options: [] });
    }
    for (const r of rows) map.get(r.date)?.options.push({ base: r.trip.price + r.priceDelta, flight: r.trip.flight });
    return [...map.values()];
  },
  ["calendar"],
  { tags: [TRIPS_TAG], revalidate: 3600 },
);

export function toIndex(trips: TripDTO[]): TripIndexItem[] {
  return trips.map(({ id, slug, title, dest, country, region, themes, kind, nights, image, price, minDelta, flight }) =>
    ({ id, slug, title, dest, country, region, themes, kind, nights, image, price, minDelta, flight }));
}
