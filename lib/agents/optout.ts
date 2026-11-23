import "server-only";
import { prisma } from "../db";
import { safeEqual, sign } from "../signing";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
const norm = (e: string) => e.trim().toLowerCase();

/** Signed link, so nobody can unsubscribe someone else by guessing their address. */
const query = (email: string) => `e=${Buffer.from(norm(email)).toString("base64url")}&s=${sign(`unsub:${norm(email)}`)}`;
/** Page with a confirm button (linked in the email footer). */
export const unsubscribeUrl = (email: string) => `${site()}/unsubscribe?${query(email)}`;
/** Endpoint for mail apps' one-click unsubscribe button. */
export const oneClickUrl = (email: string) => `${site()}/api/unsubscribe?${query(email)}`;

export function verifyUnsubscribe(e: string | null, s: string | null): string | null {
  if (!e || !s) return null;
  const email = norm(Buffer.from(e, "base64url").toString("utf8"));
  return email.includes("@") && safeEqual(s, sign(`unsub:${email}`)) ? email : null;
}

export async function optOut(email: string) {
  await prisma.emailOptOut.upsert({ where: { email: norm(email) }, update: {}, create: { email: norm(email) } });
  await prisma.priceWatch.updateMany({ where: { email: norm(email) }, data: { active: false } });
}

export async function optIn(email: string) {
  await prisma.emailOptOut.deleteMany({ where: { email: norm(email) } });
}

export async function isOptedOut(email: string) {
  return !!(await prisma.emailOptOut.findUnique({ where: { email: norm(email) } }));
}
