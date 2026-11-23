"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startCustomerSession } from "@/lib/customer";
import { claimBrowserMissions } from "@/lib/owner";
import { rateLimited } from "@/lib/http";
import { sendLoginCode, verifyLoginCode } from "@/lib/otp";

export type CodeResult = { ok: boolean; error?: string; retryIn?: number; redirect?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(160);
const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";

/** Only allow relative paths inside the site after sign-in. */
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/me");

export async function requestCustomerCode(rawEmail: string): Promise<CodeResult> {
  const e = emailSchema.safeParse(rawEmail);
  if (!e.success) return { ok: false, error: e.error.issues[0].message };
  if (rateLimited("otp-ip:" + (await ip()), 10)) return { ok: false, error: "Too many attempts from this network. Please wait a few minutes." };
  return sendLoginCode(e.data, "customer");
}

export async function verifyCustomerCode(rawEmail: string, code: string, next?: string): Promise<CodeResult> {
  const e = emailSchema.safeParse(rawEmail);
  if (!e.success) return { ok: false, error: e.error.issues[0].message };
  if (rateLimited("otp-verify:" + (await ip()), 30)) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const r = await verifyLoginCode(e.data, "customer", code.trim());
  if (!r.ok) return r;

  // fill in name and phone from their latest enquiry the first time they sign in
  const last = await prisma.enquiry.findFirst({ where: { email: e.data }, orderBy: { createdAt: "desc" }, select: { name: true, phone: true } });
  const customer = await prisma.customer.upsert({
    where: { email: e.data },
    update: { lastLoginAt: new Date() },
    create: { email: e.data, name: last?.name ?? null, phone: last?.phone ?? null, lastLoginAt: new Date() },
  });
  await startCustomerSession(customer.id);
  await claimBrowserMissions(customer.id); // trips started before signing in move to the account
  return { ok: true, redirect: safeNext(next) };
}
