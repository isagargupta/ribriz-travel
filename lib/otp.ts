import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { loginCodeEmail } from "./email-templates";
import { safeEqual, sign } from "./signing";

export type Purpose = "customer" | "admin";

const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_SEC = 30;
const MAX_PER_HOUR = 5;

const hashCode = (email: string, purpose: Purpose, code: string) => sign(`otp:${purpose}:${email}:${code}`);

export type SendResult = { ok: true } | { ok: false; error: string; retryIn?: number };

/** Creates a 6-digit code (only its hash is stored) and emails it. */
export async function sendLoginCode(email: string, purpose: Purpose): Promise<SendResult> {
  const hourAgo = new Date(Date.now() - 3600e3);
  const recent = await prisma.loginCode.findMany({
    where: { email, purpose, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length) {
    const since = (Date.now() - recent[0].createdAt.getTime()) / 1000;
    if (since < RESEND_AFTER_SEC) return { ok: false, error: "We just sent a code. Please wait a moment before asking for another.", retryIn: Math.ceil(RESEND_AFTER_SEC - since) };
  }
  if (recent.length >= MAX_PER_HOUR) return { ok: false, error: "Too many codes requested. Please try again in an hour." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    // older codes stop working as soon as a new one is sent
    prisma.loginCode.updateMany({ where: { email, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.loginCode.create({ data: { email, purpose, codeHash: hashCode(email, purpose, code), expiresAt: new Date(Date.now() + TTL_MIN * 60e3) } }),
  ]);
  const mail = loginCodeEmail(code, purpose === "admin");
  const sent = await sendEmail({ to: email, ...mail });
  return sent.ok ? { ok: true } : { ok: false, error: "We couldn't send the email right now. Please try again in a minute." };
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

/** Checks a code; each code allows a few attempts and can be used once. */
export async function verifyLoginCode(email: string, purpose: Purpose, code: string): Promise<VerifyResult> {
  const row = await prisma.loginCode.findFirst({
    where: { email, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt < new Date()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong tries. Ask for a new code." };

  if (!/^\d{6}$/.test(code) || !safeEqual(row.codeHash, hashCode(email, purpose, code))) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    await prisma.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, ...(left <= 0 ? { usedAt: new Date() } : {}) } });
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code." };
  }
  // single use: only one request can claim it
  const claimed = await prisma.loginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? { ok: true } : { ok: false, error: "That code was already used. Ask for a new one." };
}
