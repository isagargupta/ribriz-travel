import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { isoDate } from "./pricing";
import { TRIPS_TAG } from "./trips";

/**
 * Reviews come only from travellers who took the trip with Ribriz: one per
 * trip (mission) they went on, once the departure date has passed. The team
 * publishes them as written or rejects abuse; nothing is edited or invented.
 */

export const ReviewInput = z.object({
  missionId: z.string().min(1).max(40),
  stars: z.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(20, "Tell other travellers a little more (at least 20 characters).").max(2000),
  displayName: z.string().trim().min(2).max(60),
});

export async function publishedReviews(tripId: string, take = 8) {
  return prisma.review.findMany({ where: { tripId, status: "published" }, orderBy: { publishedAt: "desc" }, take });
}

/** The customer's trips that have started and don't have a review yet. */
export async function reviewable(customerId: string) {
  const today = isoDate(new Date());
  const missions = await prisma.mission.findMany({
    where: { customerId, tripId: { not: null }, departureId: { not: null } },
    select: { id: true, tripId: true, title: true, departureId: true },
  });
  if (!missions.length) return [];
  const deps = await prisma.departure.findMany({ where: { id: { in: missions.map((m) => m.departureId!) } }, select: { id: true, date: true } });
  const done = new Set((await prisma.review.findMany({ where: { missionId: { in: missions.map((m) => m.id) } }, select: { missionId: true } })).map((r) => r.missionId));
  return missions
    .map((m) => ({ ...m, date: deps.find((d) => d.id === m.departureId)?.date ?? null }))
    .filter((m) => m.date && m.date <= today && !done.has(m.id));
}

export class ReviewError extends Error {}

export async function submitReview(customerId: string, input: z.infer<typeof ReviewInput>) {
  const ok = (await reviewable(customerId)).find((m) => m.id === input.missionId);
  if (!ok) throw new ReviewError("You can review a trip once you've travelled on it with us.");
  return prisma.review.create({
    data: {
      tripId: ok.tripId!, missionId: ok.id, customerId, displayName: input.displayName, stars: input.stars,
      title: input.title || null, body: input.body, travelledOn: ok.date!.slice(0, 7),
    },
  });
}

/** Admin: publish or reject. Publishing updates the trip's rating everywhere. */
export async function setReviewStatus(id: string, status: "published" | "rejected" | "pending") {
  await prisma.review.update({ where: { id }, data: { status, publishedAt: status === "published" ? new Date() : null } });
  revalidateTag(TRIPS_TAG);
}
