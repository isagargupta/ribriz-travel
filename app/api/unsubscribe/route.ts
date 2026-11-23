import { NextResponse } from "next/server";
import { optIn, optOut, verifyUnsubscribe } from "@/lib/agents/optout";

/**
 * Two callers: the unsubscribe page's button (JSON body), and mail apps'
 * one-click unsubscribe (RFC 8058), which POSTs to the link in the
 * List-Unsubscribe header with e and s in the query string.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const body = q.get("e") ? {} : ((await req.json().catch(() => ({}))) as { e?: string; s?: string; undo?: boolean });
  const email = verifyUnsubscribe(q.get("e") ?? body.e ?? null, q.get("s") ?? body.s ?? null);
  if (!email) return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 400 });
  await (body.undo ? optIn(email) : optOut(email));
  return NextResponse.json({ ok: true, subscribed: !!body.undo });
}
