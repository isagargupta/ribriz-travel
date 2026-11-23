import "server-only";
import { prisma } from "./db";
import { sendEmail, teamInbox } from "./email";
import { bookingConfirmedEmail, enquiryReceivedEmail, holdConfirmationEmail, offerChosenTeamEmail, offersReadyEmail, statusUpdateEmail, teamAlertEmail, welcomeEmail } from "./email-templates";
import { OFFER_LABEL } from "./offers";
import { quote } from "./pricing";

async function load(ref: string) {
  return prisma.enquiry.findUnique({ where: { ref }, include: { trip: { select: { slug: true, nights: true, price: true, flight: true } }, dep: { select: { priceDelta: true } } } });
}

function party(e: { adults: number; children: number }) {
  return `${e.adults} adult${e.adults > 1 ? "s" : ""}${e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}`;
}

async function alertTeam(e: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const to = teamInbox();
  if (!to.length) return;
  await sendEmail({
    to, replyTo: e.email, idempotencyKey: `team-${e.ref}`,
    ...teamAlertEmail({ ref: e.ref, type: e.type, name: e.name, phone: e.phone, email: e.email, tripTitle: e.tripTitle, date: e.departure, total: e.quotedTotal, travellers: party(e), message: e.message }),
  });
}

/** Customer confirmation + team alert for a new price hold. */
export async function notifyHold(ref: string) {
  const e = await load(ref);
  if (!e || !e.departure || !e.trip) return;
  const ages: number[] = e.childAges ? JSON.parse(e.childAges) : [];
  const deposit = quote({ base: e.trip.price, delta: e.dep?.priceDelta ?? 0, flight: e.trip.flight, from: e.fromCity ?? "Mumbai", adults: e.adults, childAges: ages }).deposit;
  await Promise.all([
    sendEmail({
      to: e.email, idempotencyKey: `hold-${e.ref}`,
      ...holdConfirmationEmail({ ref: e.ref, name: e.name, tripTitle: e.tripTitle ?? "Your trip", tripSlug: e.trip.slug, date: e.departure, nights: e.trip.nights, adults: e.adults, children: e.children, total: e.quotedTotal ?? 0, from: e.fromCity, deposit }),
    }),
    alertTeam(e),
  ]);
}

/** "We got your question / request" + team alert. */
export async function notifyEnquiry(ref: string) {
  const e = await load(ref);
  if (!e) return;
  await Promise.all([
    sendEmail({ to: e.email, idempotencyKey: `enq-${e.ref}`, ...enquiryReceivedEmail({ ref: e.ref, name: e.name, type: e.type, tripTitle: e.tripTitle, message: e.message }) }),
    alertTeam(e),
  ]);
}

/** Tells the customer their request moved on (contacted, booked or closed). */
export async function notifyStatus(enquiryId: string) {
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId } });
  if (!e) return { ok: false };
  const mail = statusUpdateEmail({ ref: e.ref, name: e.name, status: e.status, tripTitle: e.tripTitle, date: e.departure });
  if (!mail) return { ok: false };
  return sendEmail({ to: e.email, idempotencyKey: `status-${e.ref}-${e.status}`, ...mail });
}

export async function notifyWelcome(email: string) {
  await sendEmail({ to: email, idempotencyKey: `welcome-${email}`, ...welcomeEmail() });
}

const offerLine = (o: { title: string; lines: string; priceInr: number | null }) => ({ title: o.title, lines: JSON.parse(o.lines) as string[], priceInr: o.priceInr });

/** Traveller: the team's options are ready to pick. */
export async function notifyOffers(enquiryId: string) {
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId }, include: { offers: { where: { status: "offered" }, orderBy: { createdAt: "asc" } } } });
  if (!e?.missionId || !e.offers.length) return;
  await sendEmail({
    to: e.email, idempotencyKey: `offers-${e.offers.map((o) => o.id).join("-")}`,
    ...offersReadyEmail({ name: e.name, label: OFFER_LABEL[e.type] ?? "Travel", ref: e.ref, offers: e.offers.map(offerLine), validUntil: e.offers[0].validUntil, missionId: e.missionId }),
  });
}

/** Team: the traveller chose an option, so book it. */
export async function notifyOfferChosen(offerId: string) {
  const o = await prisma.serviceOffer.findUnique({ where: { id: offerId }, include: { enquiry: true } });
  const to = teamInbox();
  if (!o || !to.length) return;
  const e = o.enquiry;
  await sendEmail({ to, replyTo: e.email, idempotencyKey: `chosen-${o.id}`, ...offerChosenTeamEmail({ ref: e.ref, name: e.name, phone: e.phone, email: e.email, label: OFFER_LABEL[o.service] ?? "Service", offer: offerLine(o), enquiryId: e.id }) });
}

/** Traveller: booked, with the confirmation number. */
export async function notifyBooked(offerId: string) {
  const o = await prisma.serviceOffer.findUnique({ where: { id: offerId }, include: { enquiry: true } });
  if (!o?.confirmation) return;
  await sendEmail({
    to: o.enquiry.email, idempotencyKey: `booked-${o.id}-${o.confirmation}`,
    ...bookingConfirmedEmail({ name: o.enquiry.name, label: OFFER_LABEL[o.service] ?? "Service", ref: o.enquiry.ref, offer: offerLine(o), confirmation: o.confirmation, missionId: o.missionId }),
  });
}
