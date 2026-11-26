import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { currentCustomer } from "./customer";
import { makeToken, readToken } from "./signing";

const ANON = "ribriz_anon";
const ANON_AGE = 60 * 60 * 24 * 180; // 180 days

/** Who owns missions and approvals: a signed-in customer and/or this browser. */
export interface Owner { customerId: string | null; anonId: string | null; email: string | null; name: string | null; phone: string | null }

/**
 * Reads the owner. With `create`, gives an anonymous visitor a signed browser id
 * (only possible in route handlers and server actions, where cookies can be set).
 */
export async function getOwner(create = false): Promise<Owner> {
  const jar = await cookies();
  const me = await currentCustomer().catch(() => null);
  let anonId = readToken(jar.get(ANON)?.value);
  if (!anonId && create) {
    anonId = randomBytes(12).toString("hex");
    jar.set(ANON, makeToken(anonId, ANON_AGE), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ANON_AGE });
  }
  let contact = { email: me?.email ?? null, name: me?.name ?? null, phone: me?.phone ?? null };
  // a visitor without an account who already gave their details on an earlier approval isn't asked again
  if (!me && anonId) {
    const last = await prisma.enquiry.findFirst({ where: { mission: { anonId } }, orderBy: { createdAt: "desc" }, select: { name: true, phone: true, email: true } });
    if (last) contact = last;
  }
  return { customerId: me?.id ?? null, anonId, ...contact };
}

/** Filter for records this owner may see. Never matches anything for an empty owner. */
export function ownedBy(o: Owner): Prisma.MissionWhereInput {
  const or: Prisma.MissionWhereInput[] = [];
  if (o.customerId) or.push({ customerId: o.customerId }, { members: { some: { customerId: o.customerId } } }); // co-travellers who joined
  if (o.anonId) or.push({ anonId: o.anonId });
  return or.length ? { OR: or } : { id: "__none__" };
}

export function ownsRecord(o: Owner, r: { customerId: string | null; anonId: string | null }) {
  return (!!o.customerId && r.customerId === o.customerId) || (!!o.anonId && r.anonId === o.anonId);
}

/** After sign-in, missions started in this browser move to the account. */
export async function claimBrowserMissions(customerId: string) {
  const anonId = readToken((await cookies()).get(ANON)?.value);
  if (!anonId) return;
  await prisma.$transaction([
    prisma.mission.updateMany({ where: { anonId, customerId: null }, data: { customerId } }),
    prisma.approval.updateMany({ where: { anonId, customerId: null }, data: { customerId } }),
  ]);
  const { claimBrowserProfile } = await import("./profile");
  await claimBrowserProfile(customerId, anonId);
}
