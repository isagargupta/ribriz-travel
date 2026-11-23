import "server-only";
import { pendingCard, type ApprovalCard } from "./approvals";
import type { Customer } from "@prisma/client";
import { prisma } from "./db";
import { ownedBy, type Owner } from "./owner";
import { addDays, daysBetween, isoDate } from "./pricing";
import { getProfile } from "./profile";
import { describePrefs } from "./profile-rules";
import { getDepartures, getPublishedTrips } from "./trips";
import { OFFER_LABEL } from "./offers";

/** Everything the traveller dashboard shows, in one round trip. */
export interface DashTask { kind: string; title: string; status: string; note: string | null }
export interface DashTrip {
  id: string; title: string; dest: string | null; image: string | null; date: string | null; returnDate: string | null;
  daysToGo: number | null; progress: number; tasks: DashTask[]; next: string; needsYou: number; status: string;
}
export interface FeedItem { id: string; actor: string; text: string; at: string; tripId: string; trip: string; kind: "event" | "alert" }
export interface Dashboard {
  name: string | null; email: string;
  trips: DashTrip[]; past: DashTrip[];
  approvals: ApprovalCard[];
  feed: FeedItem[];
  watching: { id: string; dest: string; slug: string; price: number }[];
  bookings: { id: string; label: string; title: string; confirmation: string | null; status: string; tripId: string | null }[];
  requests: { ref: string; type: string; title: string | null; status: string; createdAt: string; total: number | null; departure: string | null }[];
  memory: string[];
  status: string[];
}

const closed = (s: string) => s === "done" || s === "skipped";

export async function getDashboard(owner: Owner, me: Customer): Promise<Dashboard> {
  const today = isoDate(new Date());
  const [missions, trips, profile, watches, requests, alerts] = await Promise.all([
    prisma.mission.findMany({
      where: ownedBy(owner), orderBy: { updatedAt: "desc" }, take: 20,
      include: { tasks: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 12 }, approvals: { where: { status: "pending", expiresAt: { gt: new Date() } }, select: { id: true } } },
    }),
    getPublishedTrips(),
    getProfile(owner),
    prisma.priceWatch.findMany({ where: { active: true, OR: [{ customerId: me.id }, { email: me.email }] }, take: 12 }),
    prisma.enquiry.findMany({ where: { email: me.email }, orderBy: { createdAt: "desc" }, take: 30, select: { ref: true, type: true, tripTitle: true, status: true, createdAt: true, quotedTotal: true, departure: true } }),
    prisma.notification.findMany({ where: { OR: [{ customerId: me.id }, { email: me.email }] }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const shaped: DashTrip[] = [];
  for (const m of missions) {
    const t = m.tripId ? trips.find((x) => x.id === m.tripId) : null;
    const dep = t && m.departureId ? (await getDepartures(t.id)).find((d) => d.id === m.departureId) ?? null : null;
    const tasks = m.tasks.map((x) => ({ kind: x.kind, title: x.title, status: x.status, note: x.note }));
    shaped.push({
      id: m.id, title: m.title, dest: t?.dest ?? null, image: t?.image ?? null, status: m.status,
      date: dep?.date ?? null, returnDate: dep && t ? addDays(dep.date, t.nights) : null,
      daysToGo: dep ? daysBetween(today, dep.date) : null,
      progress: Math.round((tasks.filter((x) => closed(x.status)).length / Math.max(1, tasks.length)) * 100),
      tasks, needsYou: m.approvals.length,
      next: tasks.find((x) => x.status === "needs_approval")?.title ?? tasks.find((x) => !closed(x.status))?.title ?? "All set",
    });
  }
  const isPast = (x: DashTrip) => x.status === "done" || x.status === "cancelled" || (x.returnDate !== null && x.returnDate < today);
  // soonest departure first; trips without dates after, most recently active first
  const active = shaped.filter((x) => !isPast(x)).sort((a, b) => (a.daysToGo ?? 1e6) - (b.daysToGo ?? 1e6));
  const tripName = new Map(shaped.map((x) => [x.id, x.dest ?? x.title]));

  const approvals = (await Promise.all(missions.flatMap((m) => m.approvals.map((a) => pendingCard(owner, a.id))))).filter((c): c is ApprovalCard => !!c);
  const feed: FeedItem[] = [
    ...missions.flatMap((m) => m.events.map((e) => ({ id: e.id, actor: e.actor, text: e.message, at: e.createdAt.toISOString(), tripId: m.id, trip: tripName.get(m.id) ?? m.title, kind: "event" as const }))),
    ...alerts.filter((n) => !n.missionId).map((n) => ({ id: n.id, actor: "agent", text: `${n.title}. ${n.body}`, at: n.createdAt.toISOString(), tripId: "", trip: "Price alert", kind: "alert" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 18);

  const offers = await prisma.serviceOffer.findMany({ where: { missionId: { in: missions.map((m) => m.id) }, status: { in: ["chosen", "booked"] } }, orderBy: { createdAt: "desc" } });
  const memory = [...describePrefs(profile.prefs), ...profile.notes.map((n) => n.text)];

  // Riya's one-glance status, most important first
  const status: string[] = [];
  if (approvals.length) status.push(`${approvals.length} thing${approvals.length > 1 ? "s need" : " needs"} your OK`);
  const soon = active.filter((x) => x.daysToGo !== null && x.daysToGo >= 0).sort((a, b) => a.daysToGo! - b.daysToGo!)[0];
  if (soon) status.push(soon.daysToGo === 0 ? `${soon.dest} is today. Have a wonderful trip!` : `${soon.dest} in ${soon.daysToGo} day${soon.daysToGo === 1 ? "" : "s"}`);
  const working = active.reduce((n, x) => n + x.tasks.filter((t) => t.status === "in_progress" || t.status === "waiting").length, 0);
  if (working) status.push(`I'm working on ${working} task${working > 1 ? "s" : ""} for you`);
  if (watches.length) status.push(`watching ${watches.length} price${watches.length > 1 ? "s" : ""}`);
  if (!status.length) status.push(active.length ? "everything's on track" : "tell me where you'd like to go and I'll plan the rest");

  return {
    name: me.name, email: me.email, trips: active, past: shaped.filter(isPast), approvals, feed,
    watching: watches.map((w) => { const t = trips.find((x) => x.id === w.tripId); return t ? { id: w.id, dest: t.dest, slug: t.slug, price: w.lastPrice } : null; }).filter((x): x is NonNullable<typeof x> => !!x),
    bookings: offers.map((o) => ({ id: o.id, label: OFFER_LABEL[o.service] ?? o.service, title: o.title, confirmation: o.confirmation, status: o.status, tripId: o.missionId })),
    requests: requests.map((r) => ({ ref: r.ref, type: r.type, title: r.tripTitle, status: r.status, createdAt: r.createdAt.toISOString(), total: r.quotedTotal, departure: r.departure })),
    memory, status,
  };
}
