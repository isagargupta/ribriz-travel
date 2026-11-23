import "server-only";
import type { Trip } from "@prisma/client";
import { prisma } from "./db";
import type { Kind, TripDTO } from "./types";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function toDTO(t: Trip): TripDTO {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    dest: t.dest,
    country: t.country,
    region: t.region,
    kind: t.kind as Kind,
    themes: t.themes.split(",").map((x) => x.trim()).filter(Boolean),
    nights: t.nights,
    stars: t.stars,
    board: t.board,
    price: t.price,
    was: t.was,
    rating: t.rating,
    reviews: t.reviews,
    beach: t.beach,
    flight: t.flight,
    freeCancel: t.freeCancel,
    tourManager: t.tourManager,
    easyVisa: t.easyVisa,
    lastMinute: t.lastMinute,
    earlyBird: t.earlyBird,
    featured: t.featured,
    image: t.image,
    highlights: lines(t.highlights),
    days: lines(t.days),
  };
}

export async function getPublishedTrips(): Promise<TripDTO[]> {
  const rows = await prisma.trip.findMany({ where: { published: true }, orderBy: { createdAt: "asc" } });
  return rows.map(toDTO);
}

export async function getTripBySlug(slug: string): Promise<TripDTO | null> {
  const t = await prisma.trip.findFirst({ where: { slug, published: true } });
  return t ? toDTO(t) : null;
}
