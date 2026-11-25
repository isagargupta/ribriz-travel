import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { liveTrips, type LiveTrip } from "./live";
import { pushToCustomer } from "./push";
import { inShard, type Shard } from "./agents/shard";

function message(t: LiveTrip) {
  const wx = t.weather ? ` ${t.weather.icon} ${t.weather.max}°.` : "";
  if (t.phase === "leaving_soon") return { title: `${t.daysToGo === 1 ? "Tomorrow" : `In ${t.daysToGo} days`}: ${t.dest} ✈`, body: `Your checklist and tickets are ready in the app.${wx}` };
  if (t.phase === "departure_day") return { title: `Today's the day: ${t.dest}!`, body: `Have a wonderful trip. Your tickets and references are in your wallet, even offline.` };
  return { title: `Day ${t.day} of ${t.totalDays} in ${t.dest}`, body: `${t.today ?? "Free day: enjoy!"}.${wx}`.replace("..", ".") };
}

/**
 * Morning push for travellers about to leave or on a trip: today's plan, the
 * weather and where their tickets are. Once per trip per day, and only to
 * travellers who turned notifications on. Shown in their alerts too, never emailed.
 */
export async function pushTripMornings(today = new Date().toISOString().slice(0, 10), shard: Shard | null = null) {
  const customers = [...new Set((await prisma.pushSub.findMany({ select: { customerId: true } })).map((s) => s.customerId))].filter((id) => inShard(id, shard));
  let sent = 0;
  for (const customerId of customers) {
    const trips = await liveTrips({ customerId, anonId: null, email: null, name: null, phone: null });
    for (const t of trips) {
      const m = message(t);
      try {
        await prisma.notification.create({ data: { dedupeKey: `trip-day-${t.missionId}-${today}`, kind: "trip_today", title: m.title, body: m.body, url: `/me/trips/${t.missionId}`, missionId: t.missionId, customerId } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // already sent today
        throw e;
      }
      sent += await pushToCustomer(customerId, { ...m, url: `/me/trips/${t.missionId}`, tag: `trip-${t.missionId}` });
    }
  }
  return { travellers: customers.length, sent };
}
