import "server-only";
import { prisma } from "../db";
import { visaChecklist } from "../documents";
import { addDays, adultPrice, daysBetween, fmt, fmtDate, isoDate } from "../pricing";
import { getPublishedTrips } from "../trips";
import type { TripDTO } from "../types";
import { docsReminder, holdStage, isMeaningfulDrop, isPreTrip, visaReminder } from "./rules";

/**
 * Detectors look at the data and return facts worth telling a traveller about.
 * They don't send anything: the runner stores each alert once (by dedupeKey)
 * and the digest turns a person's new alerts into one email.
 */

export interface Alert {
  dedupeKey: string;
  kind: "price_drop" | "hold_expiring" | "hold_expired" | "visa_deadline" | "docs_missing" | "sold_out" | "pre_trip";
  title: string;
  body: string;
  url: string;
  missionId: string | null;
  customerId: string | null;
  anonId: string | null;
  email: string | null;
}

/** dry: report only, change nothing (for previews). */
interface Ctx { now: Date; today: string; trips: TripDTO[]; dry: boolean }

const dayWord = (n: number) => (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const dateRange = (t: TripDTO, date: string) => `${fmtDate(date)} – ${fmtDate(addDays(date, t.nights))}`;

/** Missions still being worked on, with what every detector needs. */
async function openMissions() {
  return prisma.mission.findMany({
    where: { status: { in: ["planning", "active"] } },
    include: {
      tasks: true,
      requests: { orderBy: { createdAt: "desc" }, take: 1, select: { email: true } },
    },
    take: 2000,
  });
}
type OpenMission = Awaited<ReturnType<typeof openMissions>>[number];

/** Where to email a mission's owner: their account, else the details they gave on a request. */
async function emailsFor(missions: OpenMission[]) {
  const ids = [...new Set(missions.map((m) => m.customerId).filter(Boolean))] as string[];
  const customers = await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  const byId = new Map(customers.map((c) => [c.id, c.email]));
  return (m: OpenMission) => (m.customerId ? byId.get(m.customerId) : null) ?? m.requests[0]?.email ?? null;
}

const owner = (m: OpenMission, email: string | null) => ({ missionId: m.id, customerId: m.customerId, anonId: m.anonId, email });
const hub = (m: OpenMission) => `/hub/${m.id}`;
const task = (m: OpenMission, kind: string) => m.tasks.find((t) => t.kind === kind);

/* ---------------- price watches ---------------- */

async function priceWatches(c: Ctx): Promise<Alert[]> {
  const watches = await prisma.priceWatch.findMany({ where: { active: true }, take: 5000 });
  if (!watches.length) return [];
  const deps = await prisma.departure.findMany({ where: { id: { in: watches.map((w) => w.departureId).filter(Boolean) as string[] } } });
  const depById = new Map(deps.map((d) => [d.id, d]));
  const out: Alert[] = [];
  for (const w of watches) {
    const t = c.trips.find((x) => x.id === w.tripId);
    const d = w.departureId ? depById.get(w.departureId) : null;
    // a watched date that has gone or passed ends the watch
    if (!t || (w.departureId && (!d || d.date < c.today))) {
      if (!c.dry) await prisma.priceWatch.update({ where: { id: w.id }, data: { active: false } });
      continue;
    }
    if (d && d.status !== "open") continue;
    const date = d?.date ?? t.cheapestDate;
    if (!date) continue;
    const now = adultPrice(t.price, d ? d.priceDelta : t.minDelta, t.flight, w.fromCity);
    if (isMeaningfulDrop(w.lastPrice, now)) {
      out.push({
        dedupeKey: `price:${w.id}:${now}`, kind: "price_drop",
        title: `${t.dest} is ${fmt(w.lastPrice - now)} cheaper`,
        body: `${t.title} is now ${fmt(now)} per adult${d ? ` for ${dateRange(t, d.date)}` : ` (best date ${fmtDate(date)})`}, down from ${fmt(w.lastPrice)}. Prices can change again, so hold it free for 48 hours if it suits you.`,
        url: `/trips/${t.slug}?date=${date}`,
        missionId: null, customerId: w.customerId, anonId: w.anonId, email: w.email,
      });
      if (!c.dry) await prisma.priceWatch.update({ where: { id: w.id }, data: { lastPrice: now } });
    }
  }
  return out;
}

/* ---------------- missions ---------------- */

async function missionAlerts(c: Ctx): Promise<Alert[]> {
  const missions = await openMissions();
  if (!missions.length) return [];
  const emailOf = await emailsFor(missions);
  const deps = await prisma.departure.findMany({ where: { id: { in: missions.map((m) => m.departureId).filter(Boolean) as string[] } } });
  const depById = new Map(deps.map((d) => [d.id, d]));
  const out: Alert[] = [];

  for (const m of missions) {
    const t = m.tripId ? c.trips.find((x) => x.id === m.tripId) : null;
    if (!t) continue;
    const email = emailOf(m);
    const who = owner(m, email);
    const d = m.departureId ? depById.get(m.departureId) : null;
    const held = task(m, "price_hold")?.status === "done";
    const party = m.adults + (JSON.parse(m.childAges) as number[]).length;

    // the chosen date was closed, removed or sold out before we held it
    if (m.departureId && !held && (!d || d.status !== "open" || (d.seatsLeft !== null && d.seatsLeft < party))) {
      const around = d?.date ?? c.today;
      const alts = t.depDates.filter((x) => x >= c.today).sort((a, b) => Math.abs(Date.parse(a) - Date.parse(around)) - Math.abs(Date.parse(b) - Date.parse(around))).slice(0, 3).sort();
      out.push({
        ...who, dedupeKey: `soldout:${m.id}:${m.departureId}`, kind: "sold_out",
        title: `Your ${t.dest} date is no longer available`,
        body: alts.length
          ? `${d ? fmtDate(d.date) : "The date you picked"} has sold out. Nearest open dates: ${alts.map((x) => fmtDate(x)).join(", ")}. Tell Riya which one and I'll re-plan your visa timing too.`
          : `${d ? fmtDate(d.date) : "The date you picked"} has sold out and there are no other dates right now. Ask Riya for a similar trip.`,
        url: `/trips/${t.slug}${alts[0] ? `?date=${alts[0]}` : ""}`,
      });
      continue; // date-based reminders below don't apply to a date that's gone
    }
    if (!d) continue;

    // price drop on the chosen date before it's held
    const was = Number((JSON.parse(task(m, "choose_trip")?.data ?? "{}") as { perAdult?: number }).perAdult ?? 0);
    const now = adultPrice(t.price, d.priceDelta, t.flight, m.fromCity);
    if (!held && was && isMeaningfulDrop(was, now)) {
      out.push({
        ...who, dedupeKey: `mprice:${m.id}:${d.id}:${now}`, kind: "price_drop",
        title: `Good news: ${t.dest} dropped ${fmt(was - now)}`,
        body: `${t.title}, ${dateRange(t, d.date)} is now ${fmt(now)} per adult (was ${fmt(was)}). One tap in your trip hub and I'll hold it free for 48 hours.`,
        url: hub(m),
      });
      const ct = task(m, "choose_trip")!;
      if (!c.dry) await prisma.missionTask.update({ where: { id: ct.id }, data: { data: JSON.stringify({ ...JSON.parse(ct.data ?? "{}"), perAdult: now }) } });
    }

    // visa start-by date coming up
    const visa = task(m, "visa");
    if (visa && (visa.status === "todo" || visa.status === "in_progress")) {
      const r = visaReminder(visa.dueDate, c.today);
      if (r) out.push({
        ...who, dedupeKey: `visa:${m.id}:${r.bucket}`, kind: "visa_deadline",
        title: r.daysLeft >= 0 ? `Start your visa within ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}` : "Your visa is running late",
        body: r.daysLeft >= 0
          ? `To be safe for ${t.dest} on ${fmtDate(d.date)}, the application should start by ${fmtDate(visa.dueDate!)}. ${visa.note ?? ""}`.trim()
          : `The safe start date (${fmtDate(visa.dueDate!)}) has passed. It may still be possible: ask Riya for express options today.`,
        url: hub(m),
      });
    }

    // documents still missing as the trip gets close
    const docs = docsReminder(d.date, c.today);
    if (docs && visa && visa.status !== "done" && visa.status !== "waiting" && visa.status !== "skipped") {
      const list = await visaChecklist({ customerId: m.customerId, anonId: m.anonId, email, name: null, phone: null }, m.id);
      const missing = list?.items.filter((i) => i.required && (i.state === "missing" || i.state === "issue")) ?? [];
      if (list && !list.noVisaWork && missing.length) out.push({
        ...who, dedupeKey: `docs:${m.id}:${docs.bucket}`, kind: "docs_missing",
        title: `${missing.length} visa document${missing.length > 1 ? "s" : ""} still needed`,
        body: `${docs.daysToGo} days to go. Still needed: ${missing.map((i) => i.label.toLowerCase() + (i.state === "issue" ? " (needs a fix)" : "")).join(", ")}. Snap a photo in your trip hub and I'll check it in seconds.`,
        url: hub(m),
      });
    }

    // pre-trip checklist, once
    const prep = task(m, "prep");
    if (prep && prep.status !== "done" && isPreTrip(d.date, c.today)) {
      out.push({
        ...who, dedupeKey: `prep:${m.id}`, kind: "pre_trip",
        title: `${t.dest} ${dayWord(daysBetween(c.today, d.date))}: your checklist`,
        body: `Passport (valid 6+ months), visa${task(m, "visa")?.status === "done" ? "" : " and approval letter"}, printed tickets and hotel vouchers, travel insurance, a forex card with some cash, phone roaming, chargers and adaptors. Reach the airport 3 hours early for international flights.`,
        url: hub(m),
      });
      if (!c.dry) await prisma.missionTask.update({ where: { id: prep.id }, data: { status: "done", note: `Checklist sent ${fmtDate(c.today)}.` } });
    }
  }
  return out;
}

/* ---------------- price holds ---------------- */

/** Every open hold (from the site or from Riya): a warning before it ends, an offer after. */
async function holds(c: Ctx): Promise<Alert[]> {
  const since = new Date(c.now.getTime() - 96 * 3600e3);
  const rows = await prisma.enquiry.findMany({
    where: { type: "hold", status: { in: ["new", "contacted"] }, createdAt: { gte: since } },
    include: { mission: { select: { id: true, customerId: true, anonId: true } }, dep: true },
  });
  const out: Alert[] = [];
  for (const e of rows) {
    const stage = holdStage(e.createdAt, c.now);
    const t = c.trips.find((x) => x.id === e.tripId);
    if (!stage || !t) continue;
    const hoursLeft = Math.max(1, Math.round(48 - (c.now.getTime() - e.createdAt.getTime()) / 3600e3));
    const open = e.dep && e.dep.status === "open" && e.dep.date >= c.today;
    const now = e.dep ? adultPrice(t.price, e.dep.priceDelta, t.flight, e.fromCity ?? "Mumbai") : null;
    out.push({
      dedupeKey: `hold:${e.ref}:${stage}`, kind: stage === "expiring" ? "hold_expiring" : "hold_expired",
      title: stage === "expiring" ? `Your ${t.dest} price hold ends in about ${hoursLeft} hours` : `Your ${t.dest} hold has ended`,
      body: stage === "expiring"
        ? `Hold ${e.ref} (${fmt(e.quotedTotal ?? 0)}) ends soon. Reply to this email or call us to pay the deposit and lock in the price.`
        : open && now
          ? `Hold ${e.ref} has expired. Today's price for ${fmtDate(e.dep!.date)} is ${fmt(now)} per adult. Ask Riya and I'll hold it again in one tap.`
          : `Hold ${e.ref} has expired and that date is no longer open. Ask Riya for the nearest dates.`,
      url: e.mission ? `/hub/${e.mission.id}` : `/booking?ref=${e.ref}`,
      missionId: e.mission?.id ?? null, customerId: e.mission?.customerId ?? null, anonId: e.mission?.anonId ?? null, email: e.email,
    });
  }
  return out;
}

/** Runs every detector. Each one is independent: one failing doesn't stop the rest. */
export async function detectAll(now = new Date(), dry = false) {
  const c: Ctx = { now, today: isoDate(now), trips: await getPublishedTrips(), dry };
  const results = await Promise.allSettled([priceWatches(c), missionAlerts(c), holds(c)]);
  const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message ?? r.reason));
  return { alerts: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), errors };
}
