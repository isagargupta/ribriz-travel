import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters). See .env.example.");
  return s;
}

/** Keyed hash (HMAC-SHA256, base64url). */
export function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** `payload.expiry.signature` token for cookies. Payload must not contain dots. */
export function makeToken(payload: string, maxAgeSec: number) {
  const exp = String(Date.now() + maxAgeSec * 1000);
  return `${payload}.${exp}.${sign(`${payload}.${exp}`)}`;
}

/** Returns the payload when the token is genuine and unexpired, otherwise null. */
export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [payload, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${payload}.${exp}`))) return null;
  return Number(exp) > Date.now() ? payload : null;
}
