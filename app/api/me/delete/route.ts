import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account";
import { currentCustomer } from "@/lib/customer";
import { clientIp, fail, rateLimited } from "@/lib/http";
import { getOwner } from "@/lib/owner";

/** Permanently deletes the signed-in traveller's account. Requires typing DELETE. */
export async function POST(req: Request) {
  if (await rateLimited("del:" + clientIp(req), 5)) return fail("Too many requests.", 429);
  const me = await currentCustomer();
  if (!me) return fail("Please sign in.", 401);
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") return fail("Type DELETE to confirm.");
  const r = await deleteAccount(me, await getOwner());
  return NextResponse.json({ ok: true, ...r });
}
