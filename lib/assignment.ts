import "server-only";
import { prisma } from "./db";
import { pickAssignee } from "./staff-rules";

const OPEN = ["new", "contacted"];
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Staff who can take new clients, with their open workload. */
async function pool() {
  const staff = await prisma.staff.findMany({ where: { active: true, takesNew: true }, select: { id: true } });
  const loads = await prisma.enquiry.groupBy({ by: ["assigneeId"], where: { status: { in: OPEN }, assigneeId: { in: staff.map((s) => s.id) } }, _count: true, _max: { assignedAt: true } });
  return staff.map((s) => { const l = loads.find((x) => x.assigneeId === s.id); return { id: s.id, open: l?._count ?? 0, lastAssignedAt: l?._max.assignedAt?.getTime() ?? 0 }; });
}

/**
 * Gives every open, unassigned request an owner: the client's own agent if
 * they have one, otherwise the least busy agent, who then becomes the client's
 * agent. Each employee gets one email listing what's new for them. Safe to run
 * often (on admin page loads and in the daily job).
 */
export async function assignUnassigned() {
  const todo = await prisma.enquiry.findMany({ where: { assigneeId: null, status: { in: OPEN } }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, email: true, ref: true, name: true, type: true, tripTitle: true } });
  if (!todo.length) return 0;
  const people = await pool();
  const active = new Set((await prisma.staff.findMany({ where: { active: true }, select: { id: true } })).map((s) => s.id));
  const got = new Map<string, typeof todo>();
  for (const e of todo) {
    const email = e.email.toLowerCase();
    const card = await prisma.clientCard.findUnique({ where: { email } });
    let who = card?.managerId && active.has(card.managerId) ? card.managerId : null;
    if (!who) {
      who = pickAssignee(people);
      if (!who) break; // nobody takes new clients yet: they stay in the shared queue
      await prisma.clientCard.upsert({ where: { email }, create: { email, managerId: who }, update: { managerId: who } });
    }
    await prisma.enquiry.update({ where: { id: e.id }, data: { assigneeId: who, assignedAt: new Date() } });
    const p = people.find((x) => x.id === who);
    if (p) { p.open++; p.lastAssignedAt = Date.now(); }
    got.set(who, [...(got.get(who) ?? []), e]);
  }
  await notifyAssignees(got);
  return [...got.values()].reduce((n, l) => n + l.length, 0);
}

async function notifyAssignees(got: Map<string, { ref: string; name: string; type: string; tripTitle: string | null }[]>) {
  if (!got.size || process.env.E2E === "1") return;
  const { sendEmail } = await import("./email");
  const { TYPE_LABELS } = await import("./inbox");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
  const staff = await prisma.staff.findMany({ where: { id: { in: [...got.keys()] } } });
  for (const s of staff) {
    if (s.email.endsWith(".local")) continue;
    const list = got.get(s.id)!;
    const lines = list.map((e) => `• ${e.ref} · ${esc(e.name)} · ${TYPE_LABELS[e.type] ?? e.type}${e.tripTitle ? ` · ${e.tripTitle}` : ""}`);
    await sendEmail({
      to: s.email, subject: `${list.length} new client request${list.length > 1 ? "s" : ""} for you`,
      html: `<p>Hi ${esc(s.name.split(" ")[0])},</p><p>These are now yours:</p><p>${lines.join("<br>")}</p><p><a href="${site}/admin">Open My desk</a></p>`,
      text: `These are now yours:\n${lines.join("\n")}\n\nOpen My desk: ${site}/admin`,
    }).catch(() => {});
  }
}

/** A manager moves one request to someone else (or back to the shared queue). */
export async function reassign(enquiryId: string, staffId: string | null, by: string, alsoClient: boolean) {
  const e = await prisma.enquiry.update({ where: { id: enquiryId }, data: { assigneeId: staffId, assignedAt: staffId ? new Date() : null } });
  if (alsoClient && staffId) await setClientManager(e.email, staffId, by, false);
  const to = staffId ? (await prisma.staff.findUnique({ where: { id: staffId } }))?.name : "the shared queue";
  await prisma.teamMessage.create({ data: { enquiryId, channel: "note", body: `Assigned to ${to}.`, author: by, drafted: false } });
}

/** Sets a client's agent; with `moveOpen`, their open requests move too. */
export async function setClientManager(email: string, staffId: string | null, by: string, moveOpen = true) {
  const e = email.toLowerCase();
  await prisma.clientCard.upsert({ where: { email: e }, create: { email: e, managerId: staffId }, update: { managerId: staffId } });
  if (moveOpen && staffId) await prisma.enquiry.updateMany({ where: { email: { equals: e, mode: "insensitive" }, status: { in: OPEN } }, data: { assigneeId: staffId, assignedAt: new Date() } });
  const name = staffId ? (await prisma.staff.findUnique({ where: { id: staffId } }))?.name : "nobody";
  await prisma.clientNote.create({ data: { email: e, author: by, body: `Client's agent set to ${name}.` } });
}

/** Moves all of one employee's open work and clients to another (holidays, leaving). */
export async function handOver(fromId: string, toId: string, by: string) {
  const moved = await prisma.enquiry.updateMany({ where: { assigneeId: fromId, status: { in: OPEN } }, data: { assigneeId: toId, assignedAt: new Date() } });
  await prisma.clientCard.updateMany({ where: { managerId: fromId }, data: { managerId: toId } });
  await prisma.followUp.updateMany({ where: { staffId: fromId, doneAt: null }, data: { staffId: toId } });
  return moved.count;
}

/**
 * Morning email to each employee: follow-ups due or overdue, and requests
 * waiting more than a day for a first reply. Nothing to do, no email.
 */
export async function staffMorning(now = new Date()) {
  const endOfDay = new Date(Math.ceil((now.getTime() + 5.5 * 3600e3) / 864e5) * 864e5 - 5.5 * 3600e3);
  const staff = await prisma.staff.findMany({ where: { active: true } });
  let sent = 0;
  for (const s of staff) {
    const [fus, waiting] = await Promise.all([
      prisma.followUp.findMany({ where: { staffId: s.id, doneAt: null, dueAt: { lte: endOfDay } }, orderBy: { dueAt: "asc" }, take: 30 }),
      prisma.enquiry.findMany({ where: { assigneeId: s.id, status: "new", createdAt: { lt: new Date(now.getTime() - 24 * 3600e3) } }, orderBy: { createdAt: "asc" }, take: 30, select: { ref: true, name: true } }),
    ]);
    if ((!fus.length && !waiting.length) || s.email.endsWith(".local") || process.env.E2E === "1") continue;
    const { sendEmail } = await import("./email");
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
    const when = (d: Date) => (d < now ? "overdue" : d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }));
    const f = fus.map((x) => `• ${x.title} (${when(x.dueAt)})`);
    const w = waiting.map((e) => `• ${e.ref} · ${e.name}`);
    const text = [f.length ? `Follow-ups today:\n${f.join("\n")}` : "", w.length ? `Waiting over a day for a reply:\n${w.join("\n")}` : ""].filter(Boolean).join("\n\n");
    await sendEmail({
      to: s.email, subject: `Your day: ${[fus.length && `${fus.length} follow-up${fus.length > 1 ? "s" : ""}`, waiting.length && `${waiting.length} waiting for a reply`].filter(Boolean).join(", ")}`,
      html: `<p>Good morning ${esc(s.name.split(" ")[0])},</p>${esc(text).split("\n\n").map((b) => `<p>${b.replace(/\n/g, "<br>")}</p>`).join("")}<p><a href="${site}/admin">Open My desk</a></p>`,
      text: `${text}\n\nOpen My desk: ${site}/admin`,
    }).then(() => sent++).catch(() => {});
  }
  return sent;
}
