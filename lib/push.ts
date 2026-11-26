import "server-only";
import webpush from "web-push";
import { prisma } from "./db";

export interface PushMessage { title: string; body: string; url?: string | null; tag?: string }

let ready: boolean | null = null;
function configured() {
  if (ready !== null) return ready;
  if (process.env.E2E === "1") return (ready = false); // browser tests never send pushes
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  ready = !!(pub && priv);
  if (ready) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@ribriztravel.com", pub!, priv!);
  return ready;
}

export const pushEnabled = () => configured();

/** Rough device label from the user agent, so travellers can tell their devices apart. */
export function deviceLabel(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : null;
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return [br, os].filter(Boolean).join(" on ") || null;
}

export async function saveSubscription(customerId: string, s: { endpoint: string; keys: { p256dh: string; auth: string } }, ua: string | null) {
  const data = { customerId, p256dh: s.keys.p256dh, auth: s.keys.auth, device: deviceLabel(ua) };
  await prisma.pushSub.upsert({ where: { endpoint: s.endpoint }, create: { endpoint: s.endpoint, ...data }, update: data });
}

export async function removeSubscription(customerId: string, endpoint: string) {
  await prisma.pushSub.deleteMany({ where: { customerId, endpoint } });
}

/** Sends to every device the traveller turned notifications on for. Never throws. Returns how many got it. */
export async function pushToCustomer(customerId: string, msg: PushMessage): Promise<number> {
  if (!configured()) return 0;
  const subs = await prisma.pushSub.findMany({ where: { customerId } }).catch(() => []);
  let sent = 0;
  const payload = JSON.stringify({ title: msg.title, body: msg.body.slice(0, 240), url: msg.url ?? "/me", tag: msg.tag });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "normal" });
      sent++;
      await prisma.pushSub.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => {}); // the device unsubscribed
      else console.error("push failed", code ?? e);
    }
  }));
  return sent;
}

/** Same, for a traveller known only by email (holds, payments, team messages). */
export async function pushToEmail(email: string, msg: PushMessage) {
  if (!configured()) return 0;
  const c = await prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }).catch(() => null);
  return c ? pushToCustomer(c.id, msg) : 0;
}
