import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCustomer } from "@/lib/customer";
import { fail } from "@/lib/http";
import { pushEnabled, pushToCustomer, removeSubscription, saveSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

/** Turn on push notifications for this device (signed-in travellers only). Sends a first "you're set" notification. */
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return fail("Sign in first.", 401);
  if (!pushEnabled()) return fail("Notifications aren't set up yet.", 503);
  const body = await req.json().catch(() => null);
  const sub = Sub.safeParse(body?.subscription);
  if (!sub.success) return fail("That subscription doesn't look right.");
  await saveSubscription(me.id, sub.data, req.headers.get("user-agent"));
  const sent = await pushToCustomer(me.id, { title: "You're all set ✓", body: "Riya will ping you here when something needs you: approvals, price drops, visa news and your daily trip plan.", url: "/me", tag: "welcome" });
  return NextResponse.json({ ok: true, sent });
}

/** Turn them off for this device. */
export async function DELETE(req: Request) {
  const me = await currentCustomer();
  if (!me) return fail("Sign in first.", 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string") return fail("Missing device.");
  await removeSubscription(me.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
