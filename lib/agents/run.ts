import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { sendEmail } from "../email";
import { digestEmail } from "../email-templates";
import { logEvent } from "../missions";
import { detectAll, type Alert } from "./detect";
import { writeNote } from "./digest";
import { oneClickUrl, unsubscribeUrl } from "./optout";
import { pushToCustomer, pushToEmail } from "../push";
import { pushTripMornings } from "../live-push";
import { inShard, mergeStats, shardCount, type Shard } from "./shard";

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
    const msg = { title: a.title, body: a.body, url: a.url, tag: a.dedupeKey, important: ["hold_expiring", "hold_expired", "visa_deadline", "sold_out"].includes(a.kind) };
    await (a.customerId ? pushToCustomer(a.customerId, msg) : a.email ? pushToEmail(a.email, msg) : 0);
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** One email per traveller with everything new since the last run. */
async function sendDigests(today: string, shard: Shard | null = null) {
  const pending = await prisma.notification.findMany({
    where: { emailedAt: null, email: { not: null }, createdAt: { gte: new Date(Date.now() - 3 * 864e5) } },
    orderBy: { createdAt: "asc" }, take: 2000,
  });
  const byEmail = new Map<string, typeof pending>();
  for (const n of pending) if (inShard(n.email, shard)) byEmail.set(n.email!, [...(byEmail.get(n.email!) ?? []), n]);

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

/** Round 1 for one slice of travellers: find what's new and store each alert once (it's pushed as it's stored). */
export async function detectSlice(shard: Shard | null) {
  const { alerts, errors } = await detectAll(new Date(), false, shard);
  let created = 0;
  for (const a of alerts) if (await save(a)) created++;
  const byKind = alerts.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {});
  return { found: alerts.length, new: created, byKind, detectorErrors: errors };
}

/** Round 2 for one slice: one email per traveller with everything new, and the morning trip push. */
export async function deliverSlice(shard: Shard | null, opts: { email?: boolean } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const mail = opts.email === false ? {} : await sendDigests(today, shard);
  const m = await pushTripMornings(today, shard);
  return { ...mail, morningTravellers: m.travellers, morningPushes: m.sent };
}

/** How much work there is today, to decide how many slices to run. */
async function workload() {
  const [missions, watches, pending] = await Promise.all([
    prisma.mission.count({ where: { status: { in: ["planning", "active"] } } }),
    prisma.priceWatch.count({ where: { active: true } }),
    prisma.notification.count({ where: { emailedAt: null, email: { not: null } } }),
  ]);
  return Math.max(missions + watches, pending);
}

/** Runs one round on every slice in parallel, each as its own function call with its own time limit. */
async function fanOut(origin: string, step: "detect" | "deliver" | "preview", n: number) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is needed to run the daily job in slices.");
  const results = await Promise.allSettled(Array.from({ length: n }, async (_, i) => {
    const r = await fetch(`${origin}/api/cron/daily/work?step=${step}&i=${i}&n=${n}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(295_000) });
    if (!r.ok) throw new Error(`slice ${i + 1}/${n} ${step}: HTTP ${r.status}`);
    return (await r.json()).stats as Record<string, unknown>;
  }));
  const ok = results.filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === "fulfilled").map((r) => r.value);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message ?? r.reason));
  return { ...mergeStats(ok), ...(failed.length ? { sliceErrors: failed } : {}) };
}

/**
 * The background agent: looks at every open trip, raises what's new, and sends
 * each traveller one note. With more than ~1,500 travellers the work is split
 * into slices that run in parallel (each a separate call to /api/cron/daily/work),
 * first detecting for everyone, then delivering. A slice that fails or times out
 * is picked up the next day: alerts are de-duplicated and unsent ones stay queued.
 * A run already in progress makes a second one exit early.
 */
export async function runAgents(opts: { email?: boolean; origin?: string } = {}) {
  const busy = await prisma.agentRun.findFirst({ where: { finishedAt: null, startedAt: { gt: new Date(Date.now() - 10 * 60e3) } } });
  if (busy) return { skipped: "Another run is in progress." };
  const run = await prisma.agentRun.create({ data: {} });
  try {
    const n = opts.origin ? shardCount(await workload()) : 1;
    const detected = n === 1 ? await detectSlice(null) : await fanOut(opts.origin!, "detect", n);
    const delivered = n === 1 ? await deliverSlice(null, opts) : await fanOut(opts.origin!, "deliver", n);
    const stats = { slices: n, ...detected, ...delivered } as Record<string, unknown>;
    const errs = [...((stats.detectorErrors as string[]) ?? []), ...((stats.sliceErrors as string[]) ?? [])];
    await prisma.agentRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), stats: JSON.stringify(stats), error: errs.length ? errs.join("; ").slice(0, 1000) : null } });
    return stats;
  } catch (e) {
    await prisma.agentRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), error: String((e as Error).message).slice(0, 1000) } });
    throw e;
  }
}

/** Preview through the real slicing: n parallel slice calls, nothing saved or sent. Checks the fan-out works. */
export async function previewSliced(origin: string, n: number) {
  return fanOut(origin, "preview", Math.max(1, Math.min(24, n)));
}

/** Preview: what the agents would raise right now, without saving or sending anything. */
export async function previewAgents() {
  const { alerts, errors } = await detectAll(new Date(), true);
  const seen = new Set((await prisma.notification.findMany({ where: { dedupeKey: { in: alerts.map((a) => a.dedupeKey) } }, select: { dedupeKey: true } })).map((n) => n.dedupeKey));
  return { alerts: alerts.map((a) => ({ ...a, alreadySent: seen.has(a.dedupeKey) })), errors };
}
