import "server-only";
import { prisma } from "./db";
import { getTripsForTravellers } from "./trips";

/**
 * The sales funnel for the admin: anonymous visits (lib/client/track.ts) joined
 * with real holds and payments from the database. Visits are counted by
 * browser tab, holds and payments by booking.
 */
export async function funnel(days: number) {
  const since = new Date(Date.now() - days * 864e5);
  const n = (v: unknown) => Number(v ?? 0);

  const [steps] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT
      count(DISTINCT sid) FILTER (WHERE type = 'page_view')  AS sessions,
      count(DISTINCT sid) FILTER (WHERE type = 'trip_view')  AS trip_viewers,
      count(DISTINCT sid) FILTER (WHERE type = 'hold_start') AS hold_starters,
      count(DISTINCT ref) FILTER (WHERE type = 'pay_view')   AS pay_viewers,
      count(DISTINCT sid) FILTER (WHERE type = 'chat_open')  AS chatters,
      count(DISTINCT sid) FILTER (WHERE type = 'page_view' AND device = 'mobile') AS mobile
    FROM "Event" WHERE at >= ${since}`;

  const [holds, holdsRiya, paidRows] = await Promise.all([
    prisma.enquiry.findMany({ where: { type: "hold", createdAt: { gte: since } }, select: { ref: true, tripId: true, quotedTotal: true } }),
    prisma.event.findMany({ where: { type: "hold_created", source: "riya", at: { gte: since } }, select: { ref: true } }),
    prisma.payment.findMany({ where: { status: { in: ["paid", "partially_refunded", "refunded"] }, paidAt: { gte: since } }, select: { amount: true, refundedAmount: true, enquiry: { select: { ref: true, tripId: true, type: true } } } }),
  ]);
  const paidRefs = new Set(paidRows.map((p) => p.enquiry.ref));
  const revenue = paidRows.reduce((s, p) => s + p.amount - p.refundedAmount, 0);

  // where visits came from, and how far each source's visitors got
  const sources = (await prisma.$queryRaw<{ source: string; sessions: bigint; trip_viewers: bigint; hold_starters: bigint; holds: bigint; paid: bigint }[]>`
    WITH s AS (SELECT sid, min(source) AS source FROM "Event" WHERE at >= ${since} AND sid IS NOT NULL GROUP BY sid),
    h AS (SELECT DISTINCT e.sid, e.ref FROM "Event" e WHERE e.type = 'hold_created' AND e.at >= ${since} AND e.sid IS NOT NULL)
    SELECT coalesce(s.source, 'direct') AS source,
      count(DISTINCT s.sid) AS sessions,
      count(DISTINCT s.sid) FILTER (WHERE EXISTS (SELECT 1 FROM "Event" x WHERE x.sid = s.sid AND x.type = 'trip_view' AND x.at >= ${since})) AS trip_viewers,
      count(DISTINCT s.sid) FILTER (WHERE EXISTS (SELECT 1 FROM "Event" x WHERE x.sid = s.sid AND x.type = 'hold_start' AND x.at >= ${since})) AS hold_starters,
      count(DISTINCT h.ref) AS holds,
      count(DISTINCT h.ref) FILTER (WHERE EXISTS (SELECT 1 FROM "Event" p WHERE p.type = 'paid' AND p.ref = h.ref)) AS paid
    FROM s LEFT JOIN h ON h.sid = s.sid
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`).map((r) => ({ source: r.source, sessions: n(r.sessions), tripViewers: n(r.trip_viewers), holdStarters: n(r.hold_starters), holds: n(r.holds), paid: n(r.paid) }));

  // every trip: who looked, who started, who held, who paid
  const views = await prisma.$queryRaw<{ trip_id: string; viewers: bigint; starters: bigint }[]>`
    SELECT "tripId" AS trip_id, count(DISTINCT sid) FILTER (WHERE type = 'trip_view') AS viewers, count(DISTINCT sid) FILTER (WHERE type = 'hold_start') AS starters
    FROM "Event" WHERE at >= ${since} AND "tripId" IS NOT NULL GROUP BY 1`;
  const trips = await getTripsForTravellers();
  const byTrip = trips.map((t) => {
    const v = views.find((x) => x.trip_id === t.id);
    const h = holds.filter((x) => x.tripId === t.id);
    const p = paidRows.filter((x) => x.enquiry.tripId === t.id);
    return { id: t.id, slug: t.slug, title: t.title, dest: t.dest, viewers: n(v?.viewers), starters: n(v?.starters), holds: h.length, paid: new Set(p.map((x) => x.enquiry.ref)).size, revenue: p.reduce((s, x) => s + x.amount - x.refundedAmount, 0) };
  }).filter((t) => t.viewers || t.holds || t.paid).sort((a, b) => b.viewers - a.viewers);

  const daily = (await prisma.$queryRaw<{ day: string; sessions: bigint }[]>`
    SELECT to_char(date_trunc('day', at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day, count(DISTINCT sid) AS sessions
    FROM "Event" WHERE at >= ${since} AND type = 'page_view' GROUP BY 1 ORDER BY 1`).map((r) => ({ day: r.day, sessions: n(r.sessions) }));

  const searches = (await prisma.$queryRaw<{ q: string; n: bigint }[]>`
    SELECT lower(substring(path from '\\?q=(.*)$')) AS q, count(DISTINCT sid) AS n
    FROM "Event" WHERE at >= ${since} AND type = 'page_view' AND path LIKE '/trips?q=%' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`).map((r) => ({ q: decodeURIComponent(r.q ?? ""), n: n(r.n) }));

  return {
    days,
    steps: [
      { key: "sessions", label: "Visits", n: n(steps.sessions) },
      { key: "trip_viewers", label: "Looked at a trip", n: n(steps.trip_viewers) },
      { key: "hold_starters", label: "Started a booking", n: n(steps.hold_starters) },
      { key: "holds", label: "Held a price", n: holds.length },
      { key: "pay_viewers", label: "Opened the pay page", n: n(steps.pay_viewers) },
      { key: "paid", label: "Paid", n: paidRefs.size },
    ],
    holdsViaRiya: holdsRiya.length,
    chatters: n(steps.chatters), mobileShare: n(steps.sessions) ? n(steps.mobile) / n(steps.sessions) : 0,
    revenue, sources, trips: byTrip, daily, searches,
  };
}
