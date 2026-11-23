import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { newsletterSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  if (rateLimited("nl:" + clientIp(req), 5)) return fail("Too many requests. Try again later.", 429);
  const parsed = await readJson(req, newsletterSchema);
  if ("res" in parsed) return parsed.res;
  const { email } = parsed.data;
  await prisma.subscriber.upsert({ where: { email }, update: {}, create: { email } });
  return NextResponse.json({ ok: true });
}
