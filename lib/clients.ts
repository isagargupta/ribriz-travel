import "server-only";
import { prisma } from "./db";
import { TYPE_LABELS } from "./inbox";
import { planOf } from "./payments";

const PAID = ["paid", "partially_refunded", "refunded"];

export interface ClientRow {
  email: string; name: string; phone: string; managerId: string | null; tags: string[];
  open: number; requests: number; paid: number; nextTrip: string | null; lastAt: string; hasAccount: boolean;
}

/**
 * Everyone who has asked, booked or signed up, one row per email. Search
 * matches name, email, phone or a reference. `mine` limits to one agent's clients.
 */
export async function listClients(o: { q?: string; managerId?: string | null; take?: number }) {
  const q = o.q?.trim();
  const [enqs, customers, cards] = await Promise.all([
    prisma.enquiry.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { ref: { equals: q.toUpperCase() } }] } : {},
      orderBy: { createdAt: "desc" }, take: 3000,
      select: { email: true, name: true, phone: true, status: true, createdAt: true, updatedAt: true, departure: true, payments: { where: { status: { in: PAID } }, select: { amount: true, refundedAmount: true } } },
    }),
    prisma.customer.findMany({ where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}, take: 3000, select: { email: true, name: true, phone: true, createdAt: true, lastLoginAt: true } }),
    prisma.clientCard.findMany(),
  ]);
  const card = new Map(cards.map((c) => [c.email, c]));
  const today = new Date().toISOString().slice(0, 10);
  const by = new Map<string, ClientRow>();
  for (const e of enqs) {
    const k = e.email.toLowerCase();
    const r = by.get(k) ?? { email: k, name: e.name, phone: e.phone, managerId: card.get(k)?.managerId ?? null, tags: (card.get(k)?.tags ?? "").split(",").filter(Boolean), open: 0, requests: 0, paid: 0, nextTrip: null, lastAt: e.updatedAt.toISOString(), hasAccount: false };
    r.requests++;
    if (e.status === "new" || e.status === "contacted") r.open++;
    r.paid += e.payments.reduce((n, p) => n + p.amount - p.refundedAmount, 0);
    if (e.status === "booked" && e.departure && e.departure >= today && (!r.nextTrip || e.departure < r.nextTrip)) r.nextTrip = e.departure;
    if (e.updatedAt.toISOString() > r.lastAt) r.lastAt = e.updatedAt.toISOString();
    if (!r.phone && e.phone) r.phone = e.phone;
    by.set(k, r);
  }
  for (const c of customers) {
    const k = c.email.toLowerCase();
    const r = by.get(k);
    if (r) { r.hasAccount = true; if (c.name) r.name = c.name; continue; }
    by.set(k, { email: k, name: c.name ?? k.split("@")[0], phone: c.phone ?? "", managerId: card.get(k)?.managerId ?? null, tags: (card.get(k)?.tags ?? "").split(",").filter(Boolean), open: 0, requests: 0, paid: 0, nextTrip: null, lastAt: (c.lastLoginAt ?? c.createdAt).toISOString(), hasAccount: true });
  }
  let rows = [...by.values()];
  if (o.managerId !== undefined) rows = rows.filter((r) => r.managerId === o.managerId);
  return rows.sort((a, b) => b.open - a.open || b.lastAt.localeCompare(a.lastAt)).slice(0, o.take ?? 300);
}

export type TimelineItem = { at: string; kind: "request" | "email" | "whatsapp" | "note" | "money" | "event" | "doc"; title: string; body?: string; by?: string; link?: string };

/** One client in full: who they are, their agent, trips, requests, money, documents and everything that happened. */
export async function clientView(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const [customer, card, enquiries, notes, followUps] = await Promise.all([
    prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }),
    prisma.clientCard.findUnique({ where: { email } }),
    prisma.enquiry.findMany({
      where: { email: { equals: email, mode: "insensitive" } }, orderBy: { createdAt: "desc" },
      include: { payments: { orderBy: { createdAt: "asc" } }, invoices: { orderBy: { issuedAt: "asc" } }, offers: true, messages: { orderBy: { createdAt: "desc" } }, trip: { select: { title: true, slug: true, image: true, nights: true } }, mission: { select: { id: true, customerId: true, anonId: true } }, dep: { select: { status: true, seatsLeft: true } } },
    }),
    prisma.clientNote.findMany({ where: { email }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.followUp.findMany({ where: { email, doneAt: null }, orderBy: { dueAt: "asc" }, include: { staff: { select: { name: true } } } }),
  ]);
  if (!customer && !enquiries.length && !card) return null;

  const missionIds = [...new Set([...enquiries.map((e) => e.missionId).filter((x): x is string => !!x)])];
  const missions = await prisma.mission.findMany({
    where: { OR: [{ id: { in: missionIds } }, ...(customer ? [{ customerId: customer.id }] : [])] }, orderBy: { updatedAt: "desc" },
    include: { tasks: { orderBy: { order: "asc" } }, documents: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  const profile = customer ? await prisma.travellerProfile.findUnique({ where: { customerId: customer.id } }) : null;
  const latest = enquiries[0];

  const timeline: TimelineItem[] = [
    ...enquiries.map((e) => ({ at: e.createdAt.toISOString(), kind: "request" as const, title: `New request ${e.ref}: ${TYPE_LABELS[e.type] ?? e.type}${e.tripTitle ? ` · ${e.tripTitle}` : ""}`, body: e.message ?? undefined, link: `/admin/enquiries?q=${e.ref}` })),
    ...enquiries.flatMap((e) => e.messages.map((m) => ({ at: m.createdAt.toISOString(), kind: (m.channel === "note" ? "note" : m.channel === "email" ? "email" : "whatsapp") as TimelineItem["kind"], title: m.channel === "note" ? `Note on ${e.ref}` : `${m.channel === "email" ? "Emailed" : "WhatsApp"}: ${m.subject ?? e.ref}`, body: m.body, by: m.author }))),
    ...enquiries.flatMap((e) => e.payments.filter((p) => p.paidAt).map((p) => ({ at: p.paidAt!.toISOString(), kind: "money" as const, title: `Paid ₹${p.amount.toLocaleString("en-IN")} (${p.kind}) on ${e.ref}${p.refundedAmount ? ` · ₹${p.refundedAmount.toLocaleString("en-IN")} refunded` : ""}` }))),
    ...notes.map((n) => ({ at: n.createdAt.toISOString(), kind: n.kind as TimelineItem["kind"], title: n.kind === "email" ? `Emailed: ${n.subject ?? ""}` : "Note", body: n.body, by: n.author })),
    ...missions.flatMap((m) => m.events.filter((ev) => ev.actor === "traveller" || ev.actor === "team").map((ev) => ({ at: ev.createdAt.toISOString(), kind: "event" as const, title: ev.message, by: ev.actor === "team" ? "Team" : "Client" }))),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);

  const paid = enquiries.reduce((n, e) => n + e.payments.reduce((m, p) => m + (PAID.includes(p.status) ? p.amount - p.refundedAmount : 0), 0), 0);
  const dues = enquiries.map((e) => ({ e, plan: planOf(e) })).filter((x) => x.plan.next && !x.plan.blocked).map(({ e, plan }) => ({ ref: e.ref, amount: plan.next!.amount, kind: plan.next!.kind }));
  return {
    email, name: customer?.name ?? latest?.name ?? email.split("@")[0], phone: customer?.phone ?? latest?.phone ?? "", customer, card, profile: profile ? { prefs: JSON.parse(profile.prefs) as Record<string, unknown>, notes: JSON.parse(profile.notes) as { text: string }[] } : null,
    enquiries, missions, followUps, timeline, paid, dues,
    since: [customer?.createdAt, ...enquiries.map((e) => e.createdAt)].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? new Date(),
  };
}
