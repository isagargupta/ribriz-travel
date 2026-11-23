import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { purgeExpiredDocs } from "@/lib/documents";
import { safeEqual } from "@/lib/signing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: delete visa documents past their keep-until date and expire stale approvals. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const docs = await purgeExpiredDocs();
  const approvals = await prisma.approval.updateMany({ where: { status: "pending", expiresAt: { lt: new Date() } }, data: { status: "expired" } });
  const codes = await prisma.loginCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 864e5) } } });
  return NextResponse.json({ ok: true, docsDeleted: docs, approvalsExpired: approvals.count, oldCodesDeleted: codes.count });
}
