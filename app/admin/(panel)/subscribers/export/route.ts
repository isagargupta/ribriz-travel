import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const list = await prisma.subscriber.findMany({ orderBy: { createdAt: "asc" } });
  const csv = ["email,joined", ...list.map((s) => `"${s.email.replace(/"/g, '""')}",${s.createdAt.toISOString()}`)].join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ribriz-subscribers.csv"` },
  });
}
