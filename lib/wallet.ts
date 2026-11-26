import "server-only";
import { prisma } from "./db";
import { bookingsFor, type BookingView } from "./offers";
import { ownedBy, type Owner } from "./owner";
import { addDays } from "./pricing";
import { getTripsForTravellers } from "./trips";
import { DOC_LABELS, type DocKind } from "./visa-docs";

export interface WalletDoc { id: string; kind: string; label: string; fileName: string; mime: string; size: number; status: string; findings: string[]; createdAt: string; deleteAfter: string | null }
export interface WalletPayment { id: string; ref: string; kind: string; amount: number; refunded: number; method: string | null; paymentId: string | null; paidAt: string; status: string }
export interface WalletTrip {
  missionId: string | null; title: string; dest: string | null; image: string | null; date: string | null; returnDate: string | null;
  docs: WalletDoc[]; bookings: BookingView[]; payments: WalletPayment[];
}

const PAID = ["paid", "partially_refunded", "refunded"];

/**
 * Everything a traveller carries, per trip: booking references, payment
 * receipts and the documents they or our team uploaded. Trips that ended more
 * than 60 days ago drop off (their documents are deleted 30 days after return).
 */
export async function walletFor(owner: Owner, email: string): Promise<WalletTrip[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [missions, trips, payments] = await Promise.all([
    prisma.mission.findMany({
      where: { AND: [ownedBy(owner), { status: { not: "cancelled" } }] }, orderBy: { updatedAt: "desc" }, take: 20,
      include: { documents: { orderBy: { createdAt: "desc" } } },
    }),
    getTripsForTravellers(),
    prisma.payment.findMany({
      where: { status: { in: PAID }, enquiry: { email: { equals: email, mode: "insensitive" } } },
      include: { enquiry: { select: { ref: true, missionId: true, tripTitle: true } } }, orderBy: { paidAt: "desc" },
    }),
  ]);

  const payView = (p: (typeof payments)[number]): WalletPayment => ({
    id: p.id, ref: p.enquiry.ref, kind: p.kind, amount: p.amount, refunded: p.refundedAmount, method: p.method, paymentId: p.paymentId,
    paidAt: (p.paidAt ?? p.createdAt).toISOString(), status: p.status,
  });

  const deps = await prisma.departure.findMany({ where: { id: { in: missions.map((m) => m.departureId).filter((x): x is string => !!x) } }, select: { id: true, date: true } });
  const out: WalletTrip[] = [];
  for (const m of missions) {
    const t = m.tripId ? trips.find((x) => x.id === m.tripId) : null;
    const dep = t ? deps.find((d) => d.id === m.departureId) : null;
    const returnDate = t && dep ? addDays(dep.date, t.nights) : null;
    if (returnDate && addDays(returnDate, 60) < today) continue;
    const bookings = (await bookingsFor(m.id)).filter((b) => b.status === "booked");
    const pays = payments.filter((p) => p.enquiry.missionId === m.id).map(payView);
    if (!m.documents.length && !bookings.length && !pays.length && !t) continue;
    out.push({
      missionId: m.id, title: m.title, dest: t?.dest ?? null, image: t?.image ?? null, date: dep?.date ?? null, returnDate, bookings, payments: pays,
      docs: m.documents.map((d) => ({
        id: d.id, kind: d.kind, label: DOC_LABELS[d.kind as DocKind] ?? d.kind, fileName: d.fileName, mime: d.mime, size: d.size, status: d.status,
        findings: d.findings ? JSON.parse(d.findings) : [], createdAt: d.createdAt.toISOString(), deleteAfter: d.deleteAfter?.toISOString() ?? null,
      })),
    });
  }
  // payments on requests that aren't linked to a trip in the app
  const loose = payments.filter((p) => !p.enquiry.missionId || !missions.some((m) => m.id === p.enquiry.missionId));
  if (loose.length) out.push({ missionId: null, title: "Other payments", dest: null, image: null, date: null, returnDate: null, docs: [], bookings: [], payments: loose.map(payView) });
  // soonest trip first, undated after
  return out.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/** One payment receipt, only for the traveller whose email made the booking. */
export async function receiptFor(email: string, paymentId: string) {
  const p = await prisma.payment.findFirst({
    where: { id: paymentId, status: { in: PAID }, enquiry: { email: { equals: email, mode: "insensitive" } } },
    include: { enquiry: { select: { ref: true, name: true, email: true, tripTitle: true, departure: true, adults: true, children: true, quotedTotal: true } } },
  });
  return p;
}
