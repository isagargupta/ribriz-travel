import { NextResponse } from "next/server";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { priceWatchSchema } from "@/lib/schemas";
import { WatchError, stopWatch, watchPrice } from "@/lib/watches";

export async function POST(req: Request) {
  if (await rateLimited("watch:" + clientIp(req), 10)) return fail("Too many requests. Try again later.", 429);
  const parsed = await readJson(req, priceWatchSchema);
  if ("res" in parsed) return parsed.res;
  try {
    const owner = await getOwner(true);
    return NextResponse.json({ ok: true, ...(await watchPrice(owner, parsed.data)) });
  } catch (e) {
    if (e instanceof WatchError) return fail(e.message, e.message.startsWith("Add your email") ? 422 : 400, { needEmail: e.message.startsWith("Add your email") });
    throw e;
  }
}

/** Stop one of your own price alerts. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Missing alert.");
  const ok = await stopWatch(await getOwner(), id);
  return ok ? NextResponse.json({ ok: true }) : fail("Alert not found.", 404);
}
