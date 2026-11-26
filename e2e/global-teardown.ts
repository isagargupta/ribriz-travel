import fs from "node:fs";
import { FRIEND_EMAIL, STATE, TEST_EMAIL, prisma } from "./helpers";

/** Removes everything the tests created: the test traveller, their bookings, trip plans and test-series invoices. */
export default async function teardown() {
  const enq = await prisma.enquiry.findMany({ where: { OR: [{ email: TEST_EMAIL }, { ref: { startsWith: "RB-E2E" } }] }, select: { id: true, missionId: true } });
  const ids = enq.map((e) => e.id);
  await prisma.invoice.deleteMany({ where: { enquiryId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { enquiryId: { in: ids } } });
  await prisma.enquiry.deleteMany({ where: { id: { in: ids } } });
  const c = await prisma.customer.findUnique({ where: { email: TEST_EMAIL } });
  const missionIds = [...new Set([...enq.map((e) => e.missionId).filter((x): x is string => !!x), ...(c ? (await prisma.mission.findMany({ where: { customerId: c.id }, select: { id: true } })).map((m) => m.id) : [])])];
  // trip plans Riya's test started as a guest ("E2E test: …")
  missionIds.push(...(await prisma.mission.findMany({ where: { customerId: null, OR: [{ goal: { contains: "E2E test" } }, { title: { contains: "E2E" } }] }, select: { id: true } })).map((m) => m.id));
  // files the tests uploaded (passport scans, issued visas) are removed from storage too
  const files = await prisma.travelDoc.findMany({ where: { missionId: { in: missionIds } }, select: { fileKey: true } });
  if (files.length) {
    const { createClient } = await import("@supabase/supabase-js");
    const { env } = await import("./helpers");
    const e = env();
    if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SECRET_KEY) await createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY).storage.from("visa-docs").remove(files.map((f) => f.fileKey));
  }
  await prisma.approval.deleteMany({ where: { missionId: { in: missionIds } } });
  await prisma.mission.deleteMany({ where: { id: { in: missionIds } } });
  const friend = await prisma.customer.findUnique({ where: { email: FRIEND_EMAIL } });
  if (friend) { await prisma.missionMember.deleteMany({ where: { customerId: friend.id } }); await prisma.customer.delete({ where: { id: friend.id } }); }
  // funnel events from test tabs, and trips the tests copied
  await prisma.event.deleteMany({ where: { OR: [{ sid: { startsWith: "e2e-" } }, { ref: { startsWith: "RB-E2E" } }] } });
  const raw = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")).startedAt : null;
  const started = raw ? new Date(raw) : null;
  if (started && !isNaN(started.getTime())) {
    const copies = await prisma.trip.findMany({ where: { createdAt: { gte: started }, title: { endsWith: "(copy)" }, published: false }, select: { id: true } });
    await prisma.departure.deleteMany({ where: { tripId: { in: copies.map((t) => t.id) } } });
    await prisma.trip.deleteMany({ where: { id: { in: copies.map((t) => t.id) } } });
  }
  if (c) {
    await prisma.notification.deleteMany({ where: { OR: [{ customerId: c.id }, { email: TEST_EMAIL }] } });
    await prisma.pushSub.deleteMany({ where: { customerId: c.id } });
    await prisma.travellerProfile.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } });
  }
  await prisma.docCounter.deleteMany({ where: { key: { startsWith: "test:" } } });
  await prisma.rateHit.deleteMany({ where: { OR: [{ key: { contains: ":local" } }, { key: { contains: "::1" } }, { key: { contains: "127.0.0.1" } }] } });
  await prisma.$disconnect();
}
