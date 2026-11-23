import "server-only";
import { prisma } from "./db";
import { sendEmail, teamInbox } from "./email";
import { enquiryReceivedEmail, holdConfirmationEmail, statusUpdateEmail, teamAlertEmail, welcomeEmail } from "./email-templates";
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
