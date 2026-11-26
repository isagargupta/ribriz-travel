import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, rateLimited } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["page_view", "trip_view", "hold_start", "hold_created", "pay_view", "chat_open", "chat_message", "search"]),
  sid: z.string().max(40).nullish(), source: z.string().max(60).nullish(), device: z.enum(["mobile", "desktop"]).nullish(),
  path: z.string().max(200).nullish(), tripId: z.string().max(40).nullish(), ref: z.string().max(20).nullish(),
});
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;

/** Anonymous funnel event (see lib/client/track.ts). Always 204: analytics must never cause an error on the page. */
export async function POST(req: Request) {
  try {
    if (BOT.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
    if (await rateLimited("t:" + clientIp(req), 300)) return new Response(null, { status: 204 });
    const d = Body.parse(await req.json());
    // keep the path, drop query strings except a search term on /trips
    const url = d.path ? new URL(d.path, "https://x") : null;
    const path = url ? url.pathname + (url.pathname === "/trips" && url.searchParams.get("q") ? `?q=${url.searchParams.get("q")!.slice(0, 40)}` : "") : null;
    await prisma.event.create({ data: { type: d.type, sid: d.sid ?? null, source: d.source ?? null, device: d.device ?? null, path, tripId: d.tripId ?? null, ref: d.ref ?? null } });
  } catch { /* ignore bad or duplicate beacons */ }
  return new Response(null, { status: 204 });
}
