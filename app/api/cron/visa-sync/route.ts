import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/signing";
import { syncVisaData } from "@/lib/visa-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly refresh of visa rules (see vercel.json "crons"). Vercel calls this with
 * "Authorization: Bearer <CRON_SECRET>"; anyone else gets 401.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(got, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const r = await syncVisaData();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("visa sync failed", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
