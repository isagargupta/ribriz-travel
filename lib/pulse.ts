import "server-only";
import { prisma } from "./db";

/**
 * A fingerprint of everything on a traveller's dashboard: the latest change
 * time across their trips, steps, timeline, approvals, alerts, options,
 * requests, payments, watches and memory, plus a few counts so deletions show
 * too. One query, using existing indexes. The app compares it every so often
 * and reloads the dashboard only when it changes.
 */
export async function pulse(customerId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ v: string | null }[]>`
    WITH me AS (SELECT id, email FROM "Customer" WHERE id = ${customerId}),
    ms AS (SELECT m.id, m."updatedAt" FROM "Mission" m WHERE m."customerId" = ${customerId})
    SELECT concat_ws('|',
      (SELECT max("updatedAt") FROM ms),
      (SELECT max(t."updatedAt") FROM "MissionTask" t WHERE t."missionId" IN (SELECT id FROM ms)),
      (SELECT max(e."createdAt") FROM "MissionEvent" e WHERE e."missionId" IN (SELECT id FROM ms)),
      (SELECT max(coalesce(a."decidedAt", a."createdAt")) || ':' || count(*) FILTER (WHERE a.status = 'pending') FROM "Approval" a WHERE a."missionId" IN (SELECT id FROM ms)),
      (SELECT max(n."createdAt") || ':' || count(*) FILTER (WHERE n."readAt" IS NULL) FROM "Notification" n WHERE n."customerId" = ${customerId} OR n.email = (SELECT email FROM me)),
      (SELECT max(coalesce(o."bookedAt", o."createdAt")) || ':' || string_agg(DISTINCT o.status, ',') FROM "ServiceOffer" o WHERE o."missionId" IN (SELECT id FROM ms)),
      (SELECT max(q."updatedAt") FROM "Enquiry" q WHERE q.email = (SELECT email FROM me)),
      (SELECT max(coalesce(p."paidAt", p."createdAt")) || ':' || count(*) FILTER (WHERE p.status <> 'created') FROM "Payment" p JOIN "Enquiry" q ON q.id = p."enquiryId" WHERE q.email = (SELECT email FROM me)),
      (SELECT max(w."updatedAt") || ':' || count(*) FROM "PriceWatch" w WHERE w.active AND (w."customerId" = ${customerId} OR w.email = (SELECT email FROM me))),
      (SELECT count(*) FROM "TravelDoc" d WHERE d."missionId" IN (SELECT id FROM ms)),
      (SELECT max(f."updatedAt") FROM "TravellerProfile" f WHERE f."customerId" = ${customerId}),
      (SELECT count(*) FROM ms)
    ) AS v`;
  return rows[0]?.v ?? "";
}
