import "server-only";
import { z } from "zod";
import { prisma } from "./db";
import { createHold, withRef } from "./bookings";
import { logEvent, markHeld, setTask, approvalView, type ApprovalView, type TaskKind } from "./missions";
import { ownsRecord, type Owner } from "./owner";
import { addDays, fmt, fmtDate, quote } from "./pricing";
import { getDepartures, getPublishedTrips } from "./trips";
import { contactSchema, firstError } from "./schemas";
import { acceptOffer, declineOffer } from "./offers";
import { detailLines, type ServiceKind } from "./service-fields";
import { prepareDetails } from "./services";
import { inrFor } from "./fx";

/**
 * The agent prepares actions; only the traveller can approve them. Execution is
 * plain server code with the inputs fixed when the action was proposed, so the
 * model can't change what runs after the traveller has seen it.
 */

const TTL_MS = 2 * 3600e3;

export const SERVICES = {
  custom: { label: "Custom trip from our trip designers", task: "choose_trip", promise: "A trip designer will send a day-by-day plan with the full price, usually within one working day." },
  visa: { label: "Visa application help", task: "visa", promise: "A visa expert will contact you within 4 working hours with the document list and fee." },
  forex: { label: "Forex order", task: "forex", promise: "Our forex partner will confirm the rate and delivery within 2 working hours." },
  insurance: { label: "Travel insurance", task: "insurance", promise: "We'll send plan options and a quote within 2 working hours." },
  flight: { label: "Flight booking", task: "flights", promise: "We'll send the best fares within 2 working hours." },
  hotel: { label: "Hotel booking", task: "hotels", promise: "We'll send hotel options within 2 working hours." },
} as const satisfies Record<string, { label: string; task: TaskKind; promise: string }>;
export type Service = keyof typeof SERVICES;

export interface ApprovalCard extends ApprovalView { lines: string[]; needsContact: boolean; contactDefaults: { name: string; phone: string; email: string } }

function cardFor(owner: Owner, a: Parameters<typeof approvalView>[0], lines: string[]): ApprovalCard {
  return {
    ...approvalView(a), lines,
    needsContact: !(owner.name && owner.phone && owner.email),
    contactDefaults: { name: owner.name ?? "", phone: owner.phone ?? "", email: owner.email ?? "" },
  };
}

/** Lines shown on the card, rebuilt from the stored payload so every view matches. */
export function linesFor(action: string, payload: Record<string, unknown>): string[] {
  if (action === "price_hold" || action === "accept_offer") return (payload.lines as string[]) ?? [];
  return [...detailLines(String(payload.service), (payload.details ?? {}) as Record<string, unknown>), ...((payload.extra as string[]) ?? [])];
}

export async function proposePriceHold(owner: Owner, i: { missionId?: string | null; slug: string; date: string; adults: number; childAges: number[]; from: string }) {
  const trip = (await getPublishedTrips()).find((t) => t.slug === i.slug);
  if (!trip) throw new Error("No trip with that slug.");
  const dep = (await getDepartures(trip.id)).find((d) => d.date === i.date);
  if (!dep) throw new Error("That date isn't an open departure.");
  const party = i.adults + i.childAges.length;
  if (dep.seatsLeft !== null && dep.seatsLeft < party) throw new Error(`Only ${dep.seatsLeft} seats left on that date.`);
  const q = quote({ base: trip.price, delta: dep.priceDelta, flight: trip.flight, from: i.from, adults: i.adults, childAges: i.childAges });
  const lines = [
    `${trip.title}`,
    `${fmtDate(dep.date)} – ${fmtDate(addDays(dep.date, trip.nights), { day: "numeric", month: "short", year: "numeric" })} · ${trip.nights} nights`,
    `${i.adults} adult${i.adults > 1 ? "s" : ""}${i.childAges.length ? `, ${i.childAges.length} child${i.childAges.length > 1 ? "ren" : ""}` : ""}${trip.flight ? ` · flights from ${i.from}` : ""}`,
    `Total ${fmt(q.total)} incl. GST · deposit ${fmt(q.deposit)} later`,
    "Free 48-hour hold, nothing to pay now",
  ];
  const a = await prisma.approval.create({
    data: {
      missionId: i.missionId ?? null, customerId: owner.customerId, anonId: owner.anonId, action: "price_hold",
      payload: JSON.stringify({ departureId: dep.id, adults: i.adults, childAges: i.childAges, from: i.from, expectedTotal: q.total, lines }),
      summary: `Hold ${trip.dest}, ${fmtDate(dep.date, { day: "numeric", month: "short" })} for ${party}`, amountInr: q.total, expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  if (i.missionId) {
    await setTask(i.missionId, "price_hold", { status: "needs_approval", note: `Ready to hold ${fmt(q.total)}. Waiting for your OK.` });
    await logEvent(i.missionId, "agent", `Prepared a price hold: ${trip.title}, ${fmtDate(dep.date)}, ${fmt(q.total)}.`);
  }
  return cardFor(owner, a, lines);
}

export async function proposeService(owner: Owner, i: { missionId?: string | null; service: Service; details: Record<string, string | number | string[]> }) {
  const s = SERVICES[i.service];
  // fills dates, travellers and places from the trip; throws MissingDetails if something's still unknown
  i.details = await prepareDetails(i.service as ServiceKind, i.details, i.missionId);
  const extra: string[] = [];
  if (i.service === "forex") {
    const fx = await inrFor(String(i.details.currency), Number(String(i.details.amount).replace(/[^\d.]/g, "")));
    if (fx) extra.push(`About ${fmt(fx.inr)} at today's market rate; our forex partner confirms the final rate`);
  }
  if (i.service === "visa" && i.missionId) {
    // the visa team gets the checked document list with the request
    const { visaChecklist } = await import("./documents");
    const c = await visaChecklist(owner, i.missionId);
    if (c && !c.noVisaWork) i.details = { ...i.details, documents: c.items.filter((x) => !x.byRibriz).map((x) => `${x.label}: ${x.state === "ok" ? "checked ✓" : x.state === "missing" ? "not uploaded" : x.state}`) };
  }
  const a = await prisma.approval.create({
    data: {
      missionId: i.missionId ?? null, customerId: owner.customerId, anonId: owner.anonId, action: "service_request",
      payload: JSON.stringify({ service: i.service, details: i.details, extra }), summary: s.label, expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  if (i.missionId) {
    await setTask(i.missionId, s.task, { status: "needs_approval", note: `${s.label} request ready. Waiting for your OK.` });
    await logEvent(i.missionId, "agent", `Prepared a ${s.label.toLowerCase()} request.`);
  }
  return cardFor(owner, a, [...linesFor("service_request", { service: i.service, details: i.details, extra }), s.promise]);
}

const Decision = z.object({
  decision: z.enum(["approve", "decline"]),
  contact: contactSchema.partial().optional(),
});

export type DecisionResult = { ok: true; status: string; message: string; ref?: string; chose?: string } | { ok: false; error: string };

/** Runs (or declines) an approval. Safe against double clicks and replays. */
export async function decide(owner: Owner, id: string, body: unknown): Promise<DecisionResult> {
  const parsed = Decision.safeParse(body);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const a = await prisma.approval.findUnique({ where: { id } });
  if (!a || !ownsRecord(owner, a)) return { ok: false, error: "We couldn't find that request." };
  if (a.status !== "pending") {
    if (a.action === "accept_offer" && a.status === "declined") return { ok: false, error: "This option is no longer available: you chose another one, or our team sent new options." };
    return { ok: false, error: a.status === "done" ? "This was already done." : `This request is ${a.status}.` };
  }
  if (a.expiresAt < new Date()) {
    await prisma.approval.update({ where: { id }, data: { status: "expired" } });
    return { ok: false, error: "This expired. Ask Riya to prepare it again with today's price." };
  }
  const payload = JSON.parse(a.payload) as Record<string, unknown>;

  if (parsed.data.decision === "decline") {
    await prisma.approval.update({ where: { id }, data: { status: "declined", decidedAt: new Date() } });
    if (a.action === "accept_offer") {
      await declineOffer(String(payload.offerId));
      return { ok: true, status: "declined", message: "Noted, you passed on this option." };
    }
    if (a.missionId) {
      const kind: TaskKind = a.action === "price_hold" ? "price_hold" : SERVICES[payload.service as Service].task;
      await setTask(a.missionId, kind, { status: "todo", note: "You said not now. Ask Riya whenever you're ready." });
      await logEvent(a.missionId, "traveller", `Declined: ${a.summary}.`);
    }
    return { ok: true, status: "declined", message: "No problem, nothing was done." };
  }

  // contact details: from the account, overridden by anything typed on the card
  const c = { name: parsed.data.contact?.name || owner.name || "", phone: parsed.data.contact?.phone || owner.phone || "", email: parsed.data.contact?.email || owner.email || "" };
  const contact = contactSchema.safeParse(c);
  if (!contact.success) return { ok: false, error: firstError(contact.error) };

  // claim it first so a double click can't run it twice
  const claim = await prisma.approval.updateMany({ where: { id, status: "pending" }, data: { status: "approved", decidedAt: new Date() } });
  if (claim.count !== 1) return { ok: false, error: "This is already being processed." };
  if (owner.customerId && (!owner.name || !owner.phone)) {
    await prisma.customer.update({ where: { id: owner.customerId }, data: { name: owner.name || contact.data.name, phone: owner.phone || contact.data.phone } });
  }

  try {
    if (a.action === "accept_offer") {
      const r = await acceptOffer(id, String(payload.offerId));
      if (!r.ok) {
        await prisma.approval.update({ where: { id }, data: { status: "failed", result: JSON.stringify({ error: r.error }) } });
        return { ok: false, error: r.error };
      }
      return { ok: true, status: "done", ref: r.ref, chose: r.offer.id, message: r.message };
    }
    if (a.action === "price_hold") {
      const r = await createHold({
        departureId: String(payload.departureId), adults: Number(payload.adults), childAges: payload.childAges as number[], from: String(payload.from),
        name: contact.data.name, phone: contact.data.phone, email: contact.data.email, travellers: [], message: "", expectedTotal: Number(payload.expectedTotal),
      });
      if (!r.ok) {
        await prisma.approval.update({ where: { id }, data: { status: "failed", result: JSON.stringify({ error: r.message }) } });
        if (a.missionId) await setTask(a.missionId, "price_hold", { status: "todo", note: r.message });
        return { ok: false, error: r.message };
      }
      await prisma.approval.update({ where: { id }, data: { status: "done", result: JSON.stringify({ ref: r.ref, total: r.total }) } });
      // links the request and saves the held date as the trip's date (it may differ from the one first chosen)
      if (a.missionId) await markHeld(a.missionId, { ref: r.ref, total: r.total, departureId: String(payload.departureId), actor: "traveller" });
      return { ok: true, status: "done", ref: r.ref, message: `Done! ${fmt(r.total)} is held for 48 hours (ref ${r.ref}). Pay the deposit to book any time at /pay/${r.ref}, or wait for our expert to confirm flights and rooms by email within 2 working hours.` };
    }

    const service = payload.service as Service;
    const s = SERVICES[service];
    const mission = a.missionId ? await prisma.mission.findUnique({ where: { id: a.missionId } }) : null;
    const e = await withRef((ref) => prisma.enquiry.create({
      data: {
        ref, type: service, name: contact.data.name, phone: contact.data.phone, email: contact.data.email,
        tripId: mission?.tripId ?? null, departureId: mission?.departureId ?? null, missionId: a.missionId,
        adults: mission?.adults ?? 1, children: mission ? (JSON.parse(mission.childAges) as number[]).length : 0, fromCity: mission?.fromCity ?? null,
        details: JSON.stringify(payload.details ?? {}), message: linesFor("service_request", payload).join("\n"),
      },
    }));
    await prisma.approval.update({ where: { id }, data: { status: "done", result: JSON.stringify({ ref: e.ref }) } });
    if (a.missionId) {
      await setTask(a.missionId, s.task, { status: "waiting", note: `Requested (ref ${e.ref}). ${s.promise}` , data: { ref: e.ref } });
      await logEvent(a.missionId, "traveller", `Approved: ${s.label}. Reference ${e.ref}.`);
    }
    return { ok: true, status: "done", ref: e.ref, message: `Done! Your ${s.label.toLowerCase()} request is in (ref ${e.ref}). ${s.promise}` };
  } catch (err) {
    console.error("approval failed", err);
    await prisma.approval.update({ where: { id }, data: { status: "failed", result: JSON.stringify({ error: "server" }) } });
    return { ok: false, error: "Something went wrong on our side. Nothing was charged. Please try again, or ask me to pass it to our team." };
  }
}

export async function pendingCard(owner: Owner, id: string): Promise<ApprovalCard | null> {
  const a = await prisma.approval.findUnique({ where: { id } });
  if (!a || !ownsRecord(owner, a)) return null;
  return cardFor(owner, a, linesFor(a.action, JSON.parse(a.payload)));
}

