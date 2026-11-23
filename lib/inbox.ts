import "server-only";
import { prisma } from "./db";
import { visaChecklist } from "./documents";
import { rankWork, type WorkItem } from "./inbox-rules";
import { detailLines } from "./service-fields";

export const TYPE_LABELS: Record<string, string> = { hold: "Price hold", enquiry: "Question", custom: "Custom trip", visa: "Visa", forex: "Forex", insurance: "Insurance", flight: "Flights", hotel: "Hotel" };

async function loadOpen() {
  return prisma.enquiry.findMany({
    where: { OR: [{ status: { in: ["new", "contacted"] } }, { status: "booked", offers: { some: { status: "chosen" } } }] },
    orderBy: { createdAt: "desc" }, take: 300,
    include: {
      offers: { select: { status: true, validUntil: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, channel: true } },
      mission: { select: { id: true, customerId: true, anonId: true } },
    },
  });
}
export type InboxRow = Awaited<ReturnType<typeof loadOpen>>[number] & { work: WorkItem; summary: string[] };

/** Every open request, ranked: most urgent first. */
export async function inbox(now = new Date()): Promise<InboxRow[]> {
  const rows = await loadOpen();
  const out: InboxRow[] = [];
  for (const e of rows) {
    let docsReady = false;
    if (e.type === "visa" && e.mission) {
      const c = await visaChecklist({ customerId: e.mission.customerId, anonId: e.mission.anonId, email: null, name: null, phone: null }, e.mission.id).catch(() => null);
      docsReady = !!c?.allReady;
    }
    const lastTeam = e.messages.find((m) => m.channel !== "note")?.createdAt ?? null;
    const work = rankWork({
      type: e.type, status: e.status, createdAt: e.createdAt, quotedTotal: e.quotedTotal, departure: e.departure,
      lastTeamMessageAt: lastTeam, docsReady,
      chosenUnbooked: e.offers.some((o) => o.status === "chosen"),
      optionsWaiting: e.offers.some((o) => o.status === "offered" && o.validUntil > now),
    }, now);
    if (!work) continue;
    const summary = e.details ? detailLines(e.type, JSON.parse(e.details)).slice(0, 4) : e.message ? [e.message.slice(0, 160)] : [];
    out.push({ ...e, work, summary });
  }
  return out.sort((a, b) => b.work.score - a.work.score);
}

export async function urgentCount() {
  return (await inbox()).filter((r) => r.work.level === "urgent" || r.work.level === "today").length;
}
