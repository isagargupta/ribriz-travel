import "server-only";
import type { Staff } from "@prisma/client";
import { prisma } from "./db";
import { inboxNow, type InboxRow } from "./inbox";
import { planOf } from "./payments";
import { followUpBucket, type Bucket } from "./staff-rules";

export interface DeskFollowUp { id: string; title: string; email: string; client: string; dueAt: string; bucket: Bucket; enquiryRef: string | null; staff: string }

/**
 * Everything one employee needs today (or the whole team, for managers):
 * ranked work, the shared queue, follow-ups, money to collect, departures and
 * the latest client activity.
 */
export async function desk(me: Staff, scope: "mine" | "team") {
  const now = new Date();
  const mine = (r: { assigneeId: string | null }) => scope === "team" || r.assigneeId === me.id;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // independent reads go out together
  const [rows, staffList, fus, owned, revenue] = await Promise.all([
    inboxNow(),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true } }),
    prisma.followUp.findMany({ where: { doneAt: null, ...(scope === "mine" ? { staffId: me.id } : {}) }, orderBy: { dueAt: "asc" }, take: 60 }),
    // money to collect and trips leaving soon, for this person's clients (or everyone's)
    prisma.enquiry.findMany({
      where: { ...(scope === "mine" ? { assigneeId: me.id } : {}), status: { in: ["new", "contacted", "booked"] }, quotedTotal: { gt: 0 } },
      include: { payments: true, trip: { select: { title: true, slug: true, image: true, nights: true } }, mission: { select: { id: true, customerId: true, anonId: true } }, dep: { select: { status: true, seatsLeft: true } } },
      take: 300,
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: monthStart }, status: { in: ["paid", "partially_refunded"] }, ...(scope === "mine" ? { enquiry: { assigneeId: me.id } } : {}) }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  const work = rows.filter((r) => r.assigneeId && mine(r));
  const queue = rows.filter((r) => !r.assigneeId);

  const nameOf = new Map(staffList.map((s) => [s.id, s.name]));

  const [nameRows, refRows] = await Promise.all([
    prisma.enquiry.findMany({ where: { email: { in: fus.map((f) => f.email) } }, select: { email: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.enquiry.findMany({ where: { id: { in: fus.map((f) => f.enquiryId).filter((x): x is string => !!x) } }, select: { id: true, ref: true } }),
  ]);
  const clientNames = new Map(nameRows.map((e) => [e.email.toLowerCase(), e.name]));
  const refs = new Map(refRows.map((e) => [e.id, e.ref]));
  const followUps: DeskFollowUp[] = fus.map((f) => ({ id: f.id, title: f.title, email: f.email, client: clientNames.get(f.email) ?? f.email, dueAt: f.dueAt.toISOString(), bucket: followUpBucket(f.dueAt, now), enquiryRef: f.enquiryId ? refs.get(f.enquiryId) ?? null : null, staff: nameOf.get(f.staffId) ?? "" }));

  const dues = owned.map((e) => ({ e, plan: planOf(e) })).filter((x) => x.plan.next && !x.plan.blocked).map(({ e, plan }) => ({ id: e.id, ref: e.ref, name: e.name, email: e.email, title: e.trip?.title ?? e.tripTitle ?? e.type, amount: plan.next!.amount, kind: plan.next!.kind, due: plan.balanceDue }));
  const today = new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10);
  const departures = owned.filter((e) => e.status === "booked" && e.departure && e.departure >= today && e.departure <= in30)
    .sort((a, b) => a.departure!.localeCompare(b.departure!)).map((e) => ({ id: e.id, ref: e.ref, name: e.name, email: e.email, title: e.trip?.title ?? e.tripTitle ?? "Trip", date: e.departure!, assignee: e.assigneeId ? nameOf.get(e.assigneeId) ?? "" : "" }));

  // what clients did lately: payments, uploads and messages in their trip plans
  const myEmails = scope === "team" ? null : [...new Set(owned.map((e) => e.email.toLowerCase()).concat(work.map((w) => w.email.toLowerCase())))];
  const since = new Date(now.getTime() - 7 * 864e5);
  const [paid, events] = await Promise.all([
    prisma.payment.findMany({ where: { paidAt: { gte: since }, status: { in: ["paid", "partially_refunded"] }, ...(myEmails ? { enquiry: { email: { in: myEmails, mode: "insensitive" } } } : {}) }, include: { enquiry: { select: { name: true, ref: true, email: true } } }, orderBy: { paidAt: "desc" }, take: 10 }),
    prisma.missionEvent.findMany({ where: { createdAt: { gte: since }, actor: "traveller", ...(myEmails ? { mission: { requests: { some: { email: { in: myEmails, mode: "insensitive" } } } } } : {}) }, include: { mission: { select: { title: true, requests: { select: { name: true, email: true }, take: 1 } } } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const activity = [
    ...paid.map((p) => ({ at: p.paidAt!.toISOString(), who: p.enquiry.name, email: p.enquiry.email, text: `paid ₹${p.amount.toLocaleString("en-IN")} (${p.kind}) on ${p.enquiry.ref}`, kind: "money" as const })),
    ...events.map((ev) => ({ at: ev.createdAt.toISOString(), who: ev.mission.requests[0]?.name ?? "A client", email: ev.mission.requests[0]?.email ?? "", text: ev.message.replace(/^./, (c) => c.toLowerCase()), kind: "event" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);


  return {
    work: work as InboxRow[], queue: queue as InboxRow[], followUps, dues, departures, activity, staff: staffList, nameOf: Object.fromEntries(nameOf),
    kpis: {
      open: work.length,
      urgent: work.filter((r) => r.work.level === "urgent").length,
      followToday: followUps.filter((f) => f.bucket !== "upcoming").length,
      collect: dues.reduce((n, d) => n + d.amount, 0),
      departing: departures.length,
      revenue: (revenue._sum.amount ?? 0) - (revenue._sum.refundedAmount ?? 0),
    },
  };
}
