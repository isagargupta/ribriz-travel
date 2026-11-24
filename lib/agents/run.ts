import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { sendEmail } from "../email";
import { digestEmail } from "../email-templates";
import { logEvent } from "../missions";
import { detectAll, type Alert } from "./detect";
import { writeNote } from "./digest";
import { oneClickUrl, unsubscribeUrl } from "./optout";

/** Most urgent first: these decide the email's subject. */
const URGENCY: Record<Alert["kind"], number> = { hold_expiring: 0, sold_out: 1, visa_deadline: 2, hold_expired: 3, docs_missing: 4, pre_trip: 5, price_drop: 6, review_request: 7 };
const MAX_PER_EMAIL = 6;

/** Saves an alert once. Returns false when the same alert was already raised (same dedupeKey). */
async function save(a: Alert) {
  try {
    await prisma.notification.create({
      data: { dedupeKey: a.dedupeKey, kind: a.kind, title: a.title, body: a.body, url: a.url, missionId: a.missionId, customerId: a.customerId, anonId: a.anonId, email: a.email?.toLowerCase() ?? null },
    });
    if (a.missionId) await logEvent(a.missionId, "agent", `${a.title}. ${a.body}`);
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** One email per traveller with everything new since the last run. */
async function sendDigests(today: string) {
  const pending = await prisma.notification.findMany({
    where: { emailedAt: null, email: { not: null }, createdAt: { gte: new Date(Date.now() - 3 * 864e5) } },
    orderBy: { createdAt: "asc" }, take: 2000,
  });
  const byEmail = new Map<string, typeof pending>();
  for (const n of pending) byEmail.set(n.email!, [...(byEmail.get(n.email!) ?? []), n]);

  const optedOut = new Set((await prisma.emailOptOut.findMany({ where: { email: { in: [...byEmail.keys()] } } })).map((o) => o.email));
  let sent = 0, failed = 0, skipped = 0, ai = 0;
  for (const [email, list] of byEmail) {
    const ids = list.map((n) => n.id);
    if (optedOut.has(email)) {
      // still visible in the hub, just not emailed
      await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailedAt: new Date(0) } });
      skipped++;
      continue;
    }
    const items = list.sort((a, b) => URGENCY[a.kind as Alert["kind"]] - URGENCY[b.kind as Alert["kind"]]).slice(0, MAX_PER_EMAIL).map((n) => ({ title: n.title, body: n.body, url: n.url ?? "/hub" }));
    const name = (await prisma.customer.findUnique({ where: { email }, select: { name: true } }))?.name
      ?? (await prisma.enquiry.findFirst({ where: { email }, orderBy: { createdAt: "desc" }, select: { name: true } }))?.name ?? null;
    const note = await writeNote(name, items);
    if (note.ai) ai++;
    const unsub = unsubscribeUrl(email);
    const r = await sendEmail({
      to: email,
      idempotencyKey: `digest-${email}-${today}-${ids.length}-${ids[0]}`,
      headers: { "List-Unsubscribe": `<${oneClickUrl(email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      ...digestEmail({ name, subject: note.subject, intro: note.intro, items, unsubscribe: unsub }),
    });
    if (r.ok) {
      await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailedAt: new Date() } });
      sent++;
    } else failed++;
  }
  return { emailsSent: sent, emailsFailed: failed, optedOut: skipped, aiWritten: ai };
}

/**
 * The background agent: looks at every open trip, raises what's new, and sends
 * each traveller one note. Safe to run twice: alerts are de-duplicated, and a
 * run already in progress makes a second one exit early.
 */
export async function runAgents(opts: { email?: boolean } = {}) {
  const busy = await prisma.agentRun.findFirst({ where: { finishedAt: null, startedAt: { gt: new Date(Date.now() - 10 * 60e3) } } });
  if (busy) return { skipped: "Another run is in progress." };
  const run = await prisma.agentRun.create({ data: {} });
  const now = new Date();
  try {
    const { alerts, errors } = await detectAll(now);
    let created = 0;
    for (const a of alerts) if (await save(a)) created++;
    const byKind = alerts.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {});
    const mail = opts.email === false ? null : await sendDigests(now.toISOString().slice(0, 10));
    const stats = { found: alerts.length, new: created, byKind, ...(mail ?? {}), detectorErrors: errors };
    await prisma.agentRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), stats: JSON.stringify(stats), error: errors.length ? errors.join("; ").slice(0, 1000) : null } });
    return stats;
  } catch (e) {
    await prisma.agentRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), error: String((e as Error).message).slice(0, 1000) } });
    throw e;
  }
}

/** Preview: what the agents would raise right now, without saving or sending anything. */
export async function previewAgents() {
  const { alerts, errors } = await detectAll(new Date(), true);
  const seen = new Set((await prisma.notification.findMany({ where: { dedupeKey: { in: alerts.map((a) => a.dedupeKey) } }, select: { dedupeKey: true } })).map((n) => n.dedupeKey));
  return { alerts: alerts.map((a) => ({ ...a, alreadySent: seen.has(a.dedupeKey) })), errors };
}
