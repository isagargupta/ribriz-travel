import "server-only";
import type { Customer } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { TRIPS_TAG } from "./trips";
import { prisma } from "./db";
import { endCustomerSession } from "./customer";
import { ownedBy, type Owner } from "./owner";
import { removePrivate } from "./supabase";

/**
 * The traveller's data rights (India's DPDP Act): a copy of everything we hold
 * about them, and erasure. Booking records the law requires us to keep are
 * kept; everything else goes.
 */
export async function exportData(me: Customer, owner: Owner) {
  const missions = await prisma.mission.findMany({
    where: ownedBy(owner),
    include: { tasks: true, events: true, approvals: { select: { action: true, summary: true, status: true, createdAt: true } }, documents: { select: { kind: true, fileName: true, status: true, findings: true, createdAt: true, deleteAfter: true } } },
  });
  const [requests, profile, watches, notices, reviews] = await Promise.all([
    prisma.enquiry.findMany({ where: { email: me.email }, include: { offers: true, messages: { where: { channel: { not: "note" } }, select: { channel: true, subject: true, body: true, createdAt: true } } } }),
    prisma.travellerProfile.findUnique({ where: { customerId: me.id } }),
    prisma.priceWatch.findMany({ where: { OR: [{ customerId: me.id }, { email: me.email }] } }),
    prisma.notification.findMany({ where: { OR: [{ customerId: me.id }, { email: me.email }] } }),
    prisma.review.findMany({ where: { customerId: me.id } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { email: me.email, name: me.name, phone: me.phone, createdAt: me.createdAt },
    whatRiyaRemembers: profile ? { preferences: JSON.parse(profile.prefs), notes: JSON.parse(profile.notes) } : null,
    trips: missions,
    requestsAndBookings: requests,
    priceAlerts: watches,
    updatesSent: notices,
    reviews,
    note: "Uploaded document files are not included in this export; you can open each one from your trip page.",
  };
}

/** Erases the account. Returns how many booking records were kept because the law requires it. */
export async function deleteAccount(me: Customer, owner: Owner) {
  const missions = await prisma.mission.findMany({ where: ownedBy(owner), select: { id: true } });
  const ids = missions.map((m) => m.id);
  const docs = await prisma.travelDoc.findMany({ where: { missionId: { in: ids } }, select: { fileKey: true } });
  await removePrivate(docs.map((d) => d.fileKey)); // files first, so nothing is left in storage
  const kept = await prisma.enquiry.count({ where: { email: me.email, OR: [{ status: "booked" }, { payments: { some: { status: { notIn: ["created", "failed"] } } } }] } });
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { OR: [{ customerId: me.id }, { email: me.email }, { missionId: { in: ids } }] } }),
    prisma.mission.deleteMany({ where: { id: { in: ids } } }), // tasks, events, approvals and documents go with it
    // unpaid attempts go; anything with real money stays as a financial record
    prisma.payment.deleteMany({ where: { enquiry: { email: me.email }, status: { in: ["created", "failed"] } } }),
    prisma.enquiry.deleteMany({ where: { email: me.email, status: { not: "booked" }, payments: { none: {} } } }),
    prisma.priceWatch.deleteMany({ where: { OR: [{ customerId: me.id }, { email: me.email }] } }),
    prisma.review.deleteMany({ where: { customerId: me.id } }),
    prisma.travellerProfile.deleteMany({ where: { OR: [{ customerId: me.id }, ...(owner.anonId ? [{ anonId: owner.anonId }] : [])] } }),
    prisma.subscriber.deleteMany({ where: { email: me.email } }),
    prisma.loginCode.deleteMany({ where: { email: me.email } }),
    prisma.customer.delete({ where: { id: me.id } }),
  ]);
  revalidateTag(TRIPS_TAG, { expire: 0 }); // their reviews no longer count towards trip ratings
  await endCustomerSession();
  (await cookies()).delete("ribriz_anon");
  return { keptBookings: kept };
}
