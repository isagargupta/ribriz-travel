import "server-only";
import { prisma } from "./db";
import { logEvent, setTask, type TaskKind } from "./missions";
import { fmt } from "./pricing";

/**
 * Service options, end to end:
 *   1. the team (later, a partner API) sends 1–3 options for a request
 *   2. each becomes a one-tap approval card in the trip hub and in chat
 *   3. the traveller picks one: the others are withdrawn, the team is alerted
 *   4. the team books it and records the confirmation, which lands in the hub
 */

export const OFFER_TASK: Record<string, TaskKind> = { visa: "visa", forex: "forex", insurance: "insurance", flight: "flights", hotel: "hotels" };
export const OFFER_LABEL: Record<string, string> = { visa: "Visa service", forex: "Forex", insurance: "Travel insurance", flight: "Flights", hotel: "Hotel" };

export interface NewOffer { title: string; lines: string[]; priceInr: number | null }

export class OfferError extends Error {}

/** Team action: send options for a request. Replaces any earlier options still open. */
export async function sendOffers(enquiryId: string, options: NewOffer[], validHours: number) {
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId }, include: { mission: true } });
  if (!e) throw new OfferError("Request not found.");
  if (!OFFER_TASK[e.type]) throw new OfferError("Options can be sent for visa, forex, insurance, flight and hotel requests.");
  if (!e.mission) throw new OfferError("This request didn't come through Riya, so there's no trip hub to send options to. Email or call the customer instead.");
  const opts = options.filter((o) => o.title.trim()).slice(0, 3);
  if (!opts.length) throw new OfferError("Add at least one option with a title.");
  const m = e.mission;
  const validUntil = new Date(Date.now() + Math.min(Math.max(validHours, 1), 168) * 3600e3);

  await withdrawOpen(e.id, "Replaced by new options.");
  const created = [];
  for (const o of opts) {
    const offer = await prisma.serviceOffer.create({
      data: { enquiryId: e.id, missionId: m.id, service: e.type, title: o.title.trim().slice(0, 140), lines: JSON.stringify(o.lines.map((l) => l.trim()).filter(Boolean).slice(0, 8)), priceInr: o.priceInr, validUntil },
    });
    await prisma.approval.create({
      data: {
        missionId: m.id, customerId: m.customerId, anonId: m.anonId, action: "accept_offer",
        payload: JSON.stringify({ offerId: offer.id, service: e.type, lines: [...JSON.parse(offer.lines), `Ref ${e.ref} · our team books it once you choose`] }),
        summary: `${OFFER_LABEL[e.type]}: ${offer.title}`, amountInr: o.priceInr, expiresAt: validUntil,
      },
    });
    created.push(offer);
  }
  const n = created.length;
  await setTask(m.id, OFFER_TASK[e.type], { status: "needs_approval", note: `${n === 1 ? "An option is" : `${n} options are`} ready. Pick ${n === 1 ? "it" : "one"} by ${validUntil.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}.` });
  await logEvent(m.id, "team", `Sent ${n} ${OFFER_LABEL[e.type].toLowerCase()} option${n > 1 ? "s" : ""} for ${e.ref}: ${created.map((o) => o.title + (o.priceInr ? ` (${fmt(o.priceInr)})` : "")).join("; ")}.`);
  if (e.status === "new") await prisma.enquiry.update({ where: { id: e.id }, data: { status: "contacted" } });
  return created;
}

/** Withdraws options nobody chose yet, and their cards. */
async function withdrawOpen(enquiryId: string, reason: string, exceptOfferId?: string) {
  const open = await prisma.serviceOffer.findMany({ where: { enquiryId, status: "offered", ...(exceptOfferId ? { id: { not: exceptOfferId } } : {}) }, select: { id: true, missionId: true } });
  if (!open.length) return;
  await prisma.serviceOffer.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: "declined" } });
  const cards = await prisma.approval.findMany({ where: { action: "accept_offer", status: "pending", missionId: open[0].missionId }, select: { id: true, payload: true } });
  const ids = new Set(open.map((o) => o.id));
  const mine = cards.filter((c) => ids.has((JSON.parse(c.payload) as { offerId: string }).offerId)).map((c) => c.id);
  if (mine.length) await prisma.approval.updateMany({ where: { id: { in: mine } }, data: { status: "declined", result: JSON.stringify({ reason }) } });
}

/** The traveller chose this option (the approval is already claimed by the caller). */
export async function acceptOffer(approvalId: string, offerId: string) {
  const offer = await prisma.serviceOffer.findUnique({ where: { id: offerId }, include: { enquiry: true } });
  if (!offer || offer.status !== "offered") return { ok: false as const, error: "This option is no longer available. Ask Riya for fresh options." };
  if (offer.validUntil < new Date()) {
    await prisma.serviceOffer.update({ where: { id: offer.id }, data: { status: "expired" } });
    return { ok: false as const, error: "This option has expired. Ask Riya and our team will refresh it." };
  }
  const claimed = await prisma.serviceOffer.updateMany({ where: { id: offer.id, status: "offered" }, data: { status: "chosen" } });
  if (claimed.count !== 1) return { ok: false as const, error: "This option is already being processed." };
  await withdrawOpen(offer.enquiryId, "You chose another option.", offer.id);
  await prisma.approval.update({ where: { id: approvalId }, data: { status: "done", result: JSON.stringify({ ref: offer.enquiry.ref, offerId: offer.id }) } });
  if (offer.missionId) {
    await setTask(offer.missionId, OFFER_TASK[offer.service], { status: "waiting", note: `You chose ${offer.title}${offer.priceInr ? ` (${fmt(offer.priceInr)})` : ""}. Our team is booking it and will send the confirmation here.`, data: { ref: offer.enquiry.ref, offerId: offer.id } });
    await logEvent(offer.missionId, "traveller", `Chose ${OFFER_LABEL[offer.service].toLowerCase()}: ${offer.title}.`);
  }
  return { ok: true as const, offer, ref: offer.enquiry.ref, message: `Great choice. Our team is booking ${offer.title} now and will confirm in your trip hub, usually within a few working hours.` };
}

/** The traveller passed on one option. When none are left, the step goes back to Riya. */
export async function declineOffer(offerId: string) {
  const offer = await prisma.serviceOffer.update({ where: { id: offerId }, data: { status: "declined" } }).catch(() => null);
  if (!offer?.missionId) return;
  const left = await prisma.serviceOffer.count({ where: { enquiryId: offer.enquiryId, status: { in: ["offered", "chosen", "booked"] } } });
  if (!left) await setTask(offer.missionId, OFFER_TASK[offer.service], { status: "todo", note: "You passed on these options. Tell Riya what you'd prefer and the team will find others." });
  await logEvent(offer.missionId, "traveller", `Passed on ${offer.title}.`);
}

/** Team action: the chosen option is booked with the supplier. */
export async function markOfferBooked(offerId: string, confirmation: string) {
  const ref = confirmation.trim().slice(0, 120);
  if (!ref) throw new OfferError("Add the booking reference (PNR, policy, voucher or order number).");
  const offer = await prisma.serviceOffer.findUnique({ where: { id: offerId }, include: { enquiry: true } });
  if (!offer || (offer.status !== "chosen" && offer.status !== "booked")) throw new OfferError("Only the option the traveller chose can be booked.");
  await prisma.serviceOffer.update({ where: { id: offer.id }, data: { status: "booked", confirmation: ref, bookedAt: offer.bookedAt ?? new Date() } });
  await prisma.enquiry.update({ where: { id: offer.enquiryId }, data: { status: "booked" } });
  if (offer.missionId) {
    await setTask(offer.missionId, OFFER_TASK[offer.service], { status: "done", note: `Booked: ${offer.title}. Confirmation ${ref}.` });
    await logEvent(offer.missionId, "team", `Booked ${OFFER_LABEL[offer.service].toLowerCase()}: ${offer.title}. Confirmation ${ref}.`);
  }
  return offer;
}

export interface BookingView { id: string; service: string; label: string; title: string; lines: string[]; priceInr: number | null; status: string; confirmation: string | null }

/** Chosen and booked options for a trip: the traveller's "travel pack". */
export async function bookingsFor(missionId: string): Promise<BookingView[]> {
  const rows = await prisma.serviceOffer.findMany({ where: { missionId, status: { in: ["chosen", "booked"] } }, orderBy: { createdAt: "asc" } });
  return rows.map((o) => ({ id: o.id, service: o.service, label: OFFER_LABEL[o.service] ?? o.service, title: o.title, lines: JSON.parse(o.lines), priceInr: o.priceInr, status: o.status, confirmation: o.confirmation }));
}
