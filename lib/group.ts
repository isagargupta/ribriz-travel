import "server-only";
import { prisma } from "./db";
import { logEvent } from "./missions";
import { safeEqual, sign } from "./signing";

/**
 * Group trips: the trip owner shares an invite link; co-travellers who open it
 * and sign in join the trip plan. Members see the trip in their own app, upload
 * their own documents and can pay their share. Only the owner approves holds
 * and requests.
 */
export const joinToken = (missionId: string) => sign(`join:${missionId}`).slice(0, 24);
export const inviteUrl = (missionId: string) => `/join/${missionId}?t=${joinToken(missionId)}`;
export const validJoin = (missionId: string, t: string | null | undefined) => !!t && safeEqual(t, joinToken(missionId));

export async function joinMission(missionId: string, customerId: string, name: string | null) {
  const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { customerId: true } });
  if (!m) return false;
  if (m.customerId === customerId) return true; // the owner
  const existing = await prisma.missionMember.findUnique({ where: { missionId_customerId: { missionId, customerId } } });
  await prisma.missionMember.upsert({ where: { missionId_customerId: { missionId, customerId } }, create: { missionId, customerId, name }, update: { name: name ?? undefined } });
  if (!existing) await logEvent(missionId, "traveller", `${name || "A travel companion"} joined the trip.`);
  return true;
}

/** Who's on the trip: the owner and everyone who joined. */
export async function groupOf(missionId: string) {
  const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { customerId: true, members: { orderBy: { createdAt: "asc" }, select: { customerId: true, name: true, createdAt: true } } } });
  if (!m) return null;
  const ids = [m.customerId, ...m.members.map((x) => x.customerId)].filter((x): x is string => !!x);
  const people = new Map((await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map((c) => [c.id, c]));
  return {
    ownerId: m.customerId,
    people: [
      ...(m.customerId ? [{ id: m.customerId, name: people.get(m.customerId)?.name ?? people.get(m.customerId)?.email.split("@")[0] ?? "Trip owner", owner: true }] : []),
      ...m.members.map((x) => ({ id: x.customerId, name: x.name || people.get(x.customerId)?.name || people.get(x.customerId)?.email.split("@")[0] || "Traveller", owner: false })),
    ],
  };
}
