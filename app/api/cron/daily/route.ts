import { NextResponse } from "next/server";
import { daily } from "@/lib/agents/daily";
import { previewAgents } from "@/lib/agents/run";
import { safeEqual } from "@/lib/signing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called once a day by Vercel Cron with "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ?preview=1 shows what would be sent, without sending or changing anything
  if (new URL(req.url).searchParams.get("preview") === "1") return NextResponse.json({ ok: true, preview: await previewAgents() });
  return NextResponse.json({ ok: true, ...(await daily()) });
}
