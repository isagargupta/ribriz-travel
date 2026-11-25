import { NextResponse, after } from "next/server";
import { notifyWelcome } from "@/lib/notify";
import { prisma } from "@/lib/db";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { newsletterSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  if (await rateLimited("nl:" + clientIp(req), 5)) return fail("Too many requests. Try again later.", 429);
  const parsed = await readJson(req, newsletterSchema);
  if ("res" in parsed) return parsed.res;
  const { email } = parsed.data;
  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (!existing) {
    await prisma.subscriber.create({ data: { email } });
    after(() => notifyWelcome(email));
  }
  return NextResponse.json({ ok: true });
}
