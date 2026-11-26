import "server-only";
import type { Mission, MissionTask } from "@prisma/client";
import { prisma } from "./db";
import type { Owner } from "./owner";
import { ownedBy } from "./owner";
import { getDepartures, getPublishedTrips, getTripsForTravellers } from "./trips";
import { getVisaRules } from "./visa-data";
import { PROCESSING_DAYS, VISA_META, countryName, type VisaCategory } from "./visa";
import { addDays, adultPrice, fmt, fmtDate } from "./pricing";

/** Every mission step, in the order travellers see them. */
export const TASKS = {
  choose_trip: { title: "Pick the best trip and date", order: 1 },
  price_hold: { title: "Hold the price", order: 2 },
  visa: { title: "Visa", order: 3 },
  insurance: { title: "Travel insurance", order: 4 },
  forex: { title: "Forex and cards", order: 5 },
  flights: { title: "Flights", order: 6 },
  hotels: { title: "Hotels", order: 7 },
  prep: { title: "Pre-trip checklist", order: 8 },
} as const;
export type TaskKind = keyof typeof TASKS;
export const TASK_KINDS = Object.keys(TASKS) as TaskKind[];
export type TaskStatus = "todo" | "in_progress" | "needs_approval" | "waiting" | "done" | "skipped";

export async function logEvent(missionId: string, actor: "agent" | "traveller" | "team" | "system", message: string) {
  await prisma.missionEvent.create({ data: { missionId, actor, message: message.slice(0, 500) } });
}

export async function setTask(missionId: string, kind: TaskKind, patch: { status?: TaskStatus; note?: string | null; data?: unknown; dueDate?: string | null }) {
  const data = { ...patch, data: patch.data === undefined ? undefined : JSON.stringify(patch.data) };
  await prisma.missionTask.upsert({
    where: { missionId_kind: { missionId, kind } },
    update: data,
    create: { missionId, kind, title: TASKS[kind].title, order: TASKS[kind].order, status: patch.status ?? "todo", note: patch.note ?? null, data: data.data ?? null, dueDate: patch.dueDate ?? null },
  });
  await prisma.mission.update({ where: { id: missionId }, data: { updatedAt: new Date() } });
}

export interface NewMission {
  title: string; goal: string; adults: number; childAges: number[]; fromCity: string; passport: string;
  budgetPerAdult?: number | null; needs: TaskKind[];
}

/** Creates a mission with its plan of steps. Trip choice and price hold are always part of it. */
export async function createMission(owner: Owner, m: NewMission): Promise<Mission> {
  const kinds = [...new Set<TaskKind>(["choose_trip", "price_hold", "visa", ...m.needs, "prep"])].sort((a, b) => TASKS[a].order - TASKS[b].order);
  const mission = await prisma.mission.create({
    data: {
      customerId: owner.customerId, anonId: owner.anonId,
      title: m.title.slice(0, 120), goal: m.goal.slice(0, 1000), status: "active",
      adults: m.adults, childAges: JSON.stringify(m.childAges), fromCity: m.fromCity, passport: m.passport, budgetPerAdult: m.budgetPerAdult ?? null,
      tasks: { create: kinds.map((k) => ({ kind: k, title: TASKS[k].title, order: TASKS[k].order, status: k === "choose_trip" ? "in_progress" : "todo" })) },
    },
  });
  await logEvent(mission.id, "agent", `Started your trip: “${mission.title}”. I'll handle each step and ask before anything binding.`);
  return mission;
}

export async function getOwnedMission(owner: Owner, id?: string | null) {
  const where = id ? { AND: [ownedBy(owner), { id }] } : { AND: [ownedBy(owner), { status: { in: ["planning", "active"] } }] };
  return prisma.mission.findFirst({ where, orderBy: { updatedAt: "desc" }, include: { tasks: { orderBy: { order: "asc" } } } });
}

/**
 * Locks in the trip (and date, if given) and works out what follows from it:
 * visa steps and deadlines for the traveller's passport, and whether flights
 * and hotels are already covered by the package.
 */
export async function chooseTrip(missionId: string, slug: string, date?: string | null) {
  const mission = await prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
  const trip = (await getPublishedTrips()).find((t) => t.slug === slug);
  if (!trip) throw new Error("Trip not found");
  const deps = await getDepartures(trip.id);
  const dep = date ? deps.find((d) => d.date === date) ?? null : null;
  if (date && !dep) throw new Error("That date isn't an open departure");

  await prisma.mission.update({ where: { id: missionId }, data: { tripId: trip.id, departureId: dep?.id ?? null } });
  const price = adultPrice(trip.price, dep?.priceDelta ?? trip.minDelta, trip.flight, mission.fromCity);
  await setTask(missionId, "choose_trip", {
    status: dep ? "done" : "in_progress",
    note: dep ? `${trip.title}, ${fmtDate(dep.date)} – ${fmtDate(addDays(dep.date, trip.nights))}, ${fmt(price)} per adult` : `${trip.title}; choosing the date next`,
    data: { slug: trip.slug, date: dep?.date ?? null, perAdult: price },
  });

  // visa follows from the countries on the trip and the traveller's passport
  const rules = await getVisaRules(mission.passport);
  const visas = trip.countryCodes.map((c) => ({ code: c, cat: (c === mission.passport ? "own" : rules.find((r) => r.d === c)?.c ?? "required") as VisaCategory }));
  const hard = visas.filter((v) => PROCESSING_DAYS[v.cat] > 0);
  const lead = Math.max(0, ...hard.map((v) => PROCESSING_DAYS[v.cat]));
  if (!hard.length) {
    await setTask(missionId, "visa", { status: "done", note: visas.map((v) => `${countryName(v.code)}: ${VISA_META[v.cat].label}`).join(" · ") + ". Nothing to apply for in advance." });
  } else {
    const due = dep ? addDays(dep.date, -(lead + 7)) : null;
    await setTask(missionId, "visa", {
      status: "todo",
      note: hard.map((v) => `${countryName(v.code)}: ${VISA_META[v.cat].label} (~${PROCESSING_DAYS[v.cat]} days)`).join(" · ") + (due ? `. Start by ${fmtDate(due)}.` : ""),
      dueDate: due,
    });
  }

  const tasks = await prisma.missionTask.findMany({ where: { missionId } });
  const has = (k: TaskKind) => tasks.some((t) => t.kind === k);
  if (trip.flight && has("flights")) await setTask(missionId, "flights", { status: "done", note: `Included in the package from ${mission.fromCity}.` });
  if (trip.kind !== "cruise" && has("hotels")) await setTask(missionId, "hotels", { status: "done", note: `${trip.stars}★ stay included in the package.` });
  if (trip.region === "India") {
    if (has("forex")) await setTask(missionId, "forex", { status: "skipped", note: "Domestic trip: no forex needed." });
  }
  if (dep) await setTask(missionId, "prep", { status: "todo", dueDate: addDays(dep.date, -3), note: `I'll send your checklist 3 days before you leave on ${fmtDate(dep.date)}.` });
  await logEvent(missionId, "agent", dep ? `Chose ${trip.title} leaving ${fmtDate(dep.date)}.` : `Shortlisted ${trip.title}.`);
  return { trip, dep, visas, lead };
}

/* ---------------- views ---------------- */

export interface MissionView {
  id: string; title: string; goal: string; status: string; createdAt: string; updatedAt: string;
  trip: { slug: string; title: string; image: string; dest: string; nights: number } | null;
  date: string | null; adults: number; childAges: number[]; fromCity: string; passport: string;
  tasks: { kind: string; title: string; status: string; note: string | null; dueDate: string | null }[];
  progress: number;
  approvals: ApprovalView[];
  events: { actor: string; message: string; at: string }[];
}

export interface ApprovalView { id: string; action: string; summary: string; amountInr: number | null; status: string; expiresAt: string; result: unknown }

export function approvalView(a: { id: string; action: string; summary: string; amountInr: number | null; status: string; expiresAt: Date; result: string | null }): ApprovalView {
  const expired = a.status === "pending" && a.expiresAt < new Date();
  return { id: a.id, action: a.action, summary: a.summary, amountInr: a.amountInr, status: expired ? "expired" : a.status, expiresAt: a.expiresAt.toISOString(), result: a.result ? JSON.parse(a.result) : null };
}

const isClosed = (s: string) => s === "done" || s === "skipped";

export async function missionView(owner: Owner, id: string): Promise<MissionView | null> {
  const m = await prisma.mission.findFirst({
    where: { AND: [ownedBy(owner), { id }] },
    include: { tasks: { orderBy: { order: "asc" } }, approvals: { orderBy: { createdAt: "desc" }, take: 10 }, events: { orderBy: { createdAt: "desc" }, take: 40 } },
  });
  if (!m) return null;
  const trips = await getTripsForTravellers();
  const trip = m.tripId ? trips.find((t) => t.id === m.tripId) ?? null : null;
  // the booked departure, even after it has left or closed for sale
  const dep = trip && m.departureId ? await prisma.departure.findUnique({ where: { id: m.departureId }, select: { date: true } }) : null;
  return {
    id: m.id, title: m.title, goal: m.goal, status: m.status, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
    trip: trip ? { slug: trip.slug, title: trip.title, image: trip.image, dest: trip.dest, nights: trip.nights } : null,
    date: dep?.date ?? null, adults: m.adults, childAges: JSON.parse(m.childAges), fromCity: m.fromCity, passport: m.passport,
    tasks: m.tasks.map((t) => ({ kind: t.kind, title: t.title, status: t.status, note: t.note, dueDate: t.dueDate })),
    progress: Math.round((m.tasks.filter((t) => isClosed(t.status)).length / Math.max(1, m.tasks.length)) * 100),
    approvals: m.approvals.map(approvalView),
    events: m.events.map((e) => ({ actor: e.actor, message: e.message, at: e.createdAt.toISOString() })),
  };
}

export async function listMissions(owner: Owner) {
  const ms = await prisma.mission.findMany({ where: ownedBy(owner), orderBy: { updatedAt: "desc" }, take: 30, include: { tasks: true } });
  const trips = await getTripsForTravellers();
  return ms.map((m) => {
    const trip = m.tripId ? trips.find((t) => t.id === m.tripId) : null;
    const pending = m.tasks.filter((t) => t.status === "needs_approval").length;
    return {
      id: m.id, title: m.title, status: m.status, updatedAt: m.updatedAt.toISOString(), image: trip?.image ?? null, dest: trip?.dest ?? null,
      progress: Math.round((m.tasks.filter((t) => isClosed(t.status)).length / Math.max(1, m.tasks.length)) * 100),
      needsYou: pending, next: m.tasks.find((t) => !isClosed(t.status))?.title ?? "All done",
    };
  });
}

/** Short summary of a traveller's open missions, for the assistant's context. */
export async function missionsForContext(owner: Owner) {
  if (!owner.customerId && !owner.anonId) return [];
  const ms = await prisma.mission.findMany({ where: { AND: [ownedBy(owner), { status: { in: ["planning", "active"] } }] }, orderBy: { updatedAt: "desc" }, take: 3, include: { tasks: { orderBy: { order: "asc" } } } });
  const trips = await getTripsForTravellers();
  return ms.map((m) => ({
    id: m.id, title: m.title, goal: m.goal,
    trip: m.tripId ? trips.find((t) => t.id === m.tripId)?.slug ?? null : null,
    tasks: m.tasks.map((t: MissionTask) => `${t.kind}=${t.status}${t.note ? ` (${t.note.slice(0, 80)})` : ""}`).join("; "),
  }));
}


/** "27 Nov 2026, 3:30 pm" in India time, whatever the server's time zone. */
export const istTime = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST";

/**
 * Records a price hold on its trip plan: links the request, saves the held
 * date as the trip's date, and marks the hold step done. Used for holds
 * approved in chat and holds made on the trip page.
 */
export async function markHeld(missionId: string, h: { ref: string; total: number; departureId: string; actor: "traveller" | "agent"; via: "site" | "riya" }) {
  await prisma.enquiry.update({ where: { ref: h.ref }, data: { missionId } });
  await prisma.mission.update({ where: { id: missionId }, data: { departureId: h.departureId, status: "active" } });
  const until = new Date(Date.now() + 48 * 3600e3);
  await setTask(missionId, "price_hold", { status: "done", note: `Held ${fmt(h.total)} until ${istTime(until)}. Ref ${h.ref}.`, data: { ref: h.ref, until: until.toISOString() } });
  await logEvent(missionId, h.actor, `Price hold placed. Reference ${h.ref}.`);
  // funnel: holds made on the trip page are counted by the page itself (with the visit's source); Riya's here
  if (h.via === "riya") {
    const e = await prisma.enquiry.findUnique({ where: { ref: h.ref }, select: { tripId: true } });
    await prisma.event.create({ data: { type: "hold_created", ref: h.ref, tripId: e?.tripId ?? null, source: "riya" } }).catch(() => {});
  }
}

/**
 * A hold made on the trip page (not through Riya) becomes a trip plan too, so
 * it gets live trip mode, the wallet, the document checklist and reminders.
 * Joins the traveller's open plan for the same trip, or starts one.
 */
export async function linkHoldToMission(owner: Owner, ref: string) {
  if (!owner.customerId && !owner.anonId) return null;
  const e = await prisma.enquiry.findUnique({ where: { ref }, include: { trip: true, dep: true } });
  if (!e?.trip || !e.dep || e.missionId) return e?.missionId ?? null;
  let m = await prisma.mission.findFirst({ where: { AND: [ownedBy(owner), { status: { in: ["planning", "active"] }, tripId: e.trip.id }] }, orderBy: { updatedAt: "desc" } });
  if (!m) {
    m = await createMission(owner, {
      title: `${e.trip.dest}, ${fmtDate(e.dep.date, { month: "short", year: "numeric" })}`, goal: `Booked ${e.trip.title} on the website.`,
      adults: e.adults, childAges: e.childAges ? JSON.parse(e.childAges) : [], fromCity: e.fromCity ?? "Mumbai", passport: "IN",
      needs: e.trip.countryCodes.split(",").some((c) => c && c !== "IN") ? ["insurance", "forex"] : [],
    });
  }
  try { await chooseTrip(m.id, e.trip.slug, e.dep.date); } catch { /* date just closed: the hold still stands */ }
  await markHeld(m.id, { ref, total: e.quotedTotal ?? 0, departureId: e.dep.id, actor: "traveller", via: "site" });
  return m.id;
}

/**
 * Daily: a price hold that ended without a payment no longer counts as done, so
 * the plan (and the agents watching prices and seats) treat the trip as not held.
 */
export async function resetLapsedHolds(now = new Date()) {
  const ended = await prisma.enquiry.findMany({
    where: { type: "hold", status: { in: ["new", "contacted"] }, missionId: { not: null }, createdAt: { lt: new Date(now.getTime() - 48 * 3600e3), gt: new Date(now.getTime() - 30 * 864e5) }, payments: { none: { status: { in: ["paid", "partially_refunded"] } } } },
    select: { ref: true, missionId: true },
  });
  let reset = 0;
  for (const e of ended) {
    const t = await prisma.missionTask.findUnique({ where: { missionId_kind: { missionId: e.missionId!, kind: "price_hold" } } });
    if (t?.status !== "done" || !t.data?.includes(e.ref)) continue; // a newer hold or a payment took over
    await setTask(e.missionId!, "price_hold", { status: "todo", note: `Your hold ${e.ref} ended without a deposit. Ask me to hold it again; I'll check the price first.` });
    await logEvent(e.missionId!, "agent", `Price hold ${e.ref} ended without a deposit.`);
    reset++;
  }
  return reset;
}
