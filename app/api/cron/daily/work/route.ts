import { NextResponse } from "next/server";
import { deliverSlice, detectSlice } from "@/lib/agents/run";
import { detectAll } from "@/lib/agents/detect";
import { safeEqual } from "@/lib/signing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One slice of the daily job (?step=detect|deliver|preview&i=0&n=4), called in parallel
 * by the daily run itself. Same secret as the cron.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const i = Number(q.get("i")), n = Number(q.get("n")), step = q.get("step");
  if (!Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 64 || i < 0 || i >= n || (step !== "detect" && step !== "deliver" && step !== "preview")) return NextResponse.json({ error: "Bad slice" }, { status: 400 });
  const shard = { i, n };
  // preview: what this slice would raise, without saving or sending anything (used to check the slicing)
  if (step === "preview") { const r = await detectAll(new Date(), true, shard); return NextResponse.json({ ok: true, stats: { found: r.alerts.length, keys: r.alerts.map((a) => a.dedupeKey), detectorErrors: r.errors } }); }
  const stats = step === "detect" ? await detectSlice(shard) : await deliverSlice(shard);
  return NextResponse.json({ ok: true, stats });
}
