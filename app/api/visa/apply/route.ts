import { NextResponse, after } from "next/server";
import { z } from "zod";
import { clientIp, fail, rateLimited, readJson } from "@/lib/http";
import { getOwner } from "@/lib/owner";
import { VisaError, startApplication } from "@/lib/visa-service";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  product: z.string().min(2).max(80),
  travellers: z.array(z.string().trim().min(2, "Add each traveller's name as on their passport.").max(80)).min(1).max(9),
  arrive: date, depart: date.nullish(), purpose: z.string().max(60).default("Tourism"),
  name: z.string().trim().min(2, "Add your name.").max(80), email: z.string().trim().email("Add a valid email."), phone: z.string().trim().min(8, "Add a mobile number.").max(30),
});

/** Starts a visa application. Documents are uploaded next, then payment. */
export async function POST(req: Request) {
  if (await rateLimited("visa-apply:" + clientIp(req), 10)) return fail("Too many applications from this network. Please wait a few minutes.", 429);
  const parsed = await readJson(req, Body);
  if ("res" in parsed) return parsed.res;
  const d = parsed.data;
  if (d.arrive < new Date().toISOString().slice(0, 10)) return fail("Your travel date is in the past.");
  try {
    const r = await startApplication(await getOwner(true), { ...d, depart: d.depart ?? null });
    after(async () => { const { notifyEnquiry } = await import("@/lib/notify"); await notifyEnquiry(r.ref); });
    return NextResponse.json({ ok: true, ...r }, { status: 201 });
  } catch (e) {
    if (e instanceof VisaError) return fail(e.message);
    throw e;
  }
}
