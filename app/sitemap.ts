import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getDestinations } from "@/lib/destinations";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const trips = await prisma.trip.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/trips`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/plan`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/visa`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/destinations`, changeFrequency: "weekly", priority: 0.8 },
    ...(await getDestinations()).map((d) => ({ url: `${base}/destinations/${d.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...trips.map((t) => ({ url: `${base}/trips/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
