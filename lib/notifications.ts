import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Owner } from "./owner";

export interface NoticeView { id: string; kind: string; title: string; body: string; url: string | null; at: string; unread: boolean }

/** Alerts the background agent raised for this traveller: by account, browser or email. */
function mine(o: Owner): Prisma.NotificationWhereInput {
  const or: Prisma.NotificationWhereInput[] = [];
  if (o.customerId) or.push({ customerId: o.customerId });
  if (o.anonId) or.push({ anonId: o.anonId });
  if (o.customerId && o.email) or.push({ email: o.email.toLowerCase() }); // only a verified (signed-in) email
  return or.length ? { OR: or } : { id: "__none__" };
}

export async function noticesFor(owner: Owner, opts: { missionId?: string; take?: number; sinceDays?: number } = {}): Promise<NoticeView[]> {
  const rows = await prisma.notification.findMany({
    where: { AND: [mine(owner), opts.missionId ? { missionId: opts.missionId } : {}, opts.sinceDays ? { createdAt: { gte: new Date(Date.now() - opts.sinceDays * 864e5) } } : {}] },
    orderBy: { createdAt: "desc" }, take: opts.take ?? 10,
  });
  return rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url, at: n.createdAt.toISOString(), unread: !n.readAt }));
}

export async function markSeen(owner: Owner, ids: string[]) {
  if (!ids.length) return;
  await prisma.notification.updateMany({ where: { AND: [mine(owner), { id: { in: ids } }, { readAt: null }] }, data: { readAt: new Date() } });
}
