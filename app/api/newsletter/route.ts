import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EMAIL_RE, clean, clientIp, rateLimited } from "@/lib/validate";

export async function POST(req: Request) {
  if (rateLimited("nl:" + clientIp(req), 5)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = clean(body.email, 160).toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await prisma.subscriber.upsert({ where: { email }, update: {}, create: { email } });
  return NextResponse.json({ ok: true });
}
