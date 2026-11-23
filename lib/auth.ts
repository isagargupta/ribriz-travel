import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { makeToken, readToken, safeEqual, sign } from "./signing";

const COOKIE = "ribriz_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** Emails allowed to sign in to the admin with a code (comma-separated ADMIN_EMAILS). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function passwordLoginEnabled() {
  return !!process.env.ADMIN_PASSWORD;
}

export function passwordMatches(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // compare keyed hashes so lengths always match
  return safeEqual(sign("pw:" + input), sign("pw:" + pw));
}

/** `who` is the admin's email, or "password" for the shared-password login. */
export async function startSession(who = "password") {
  (await cookies()).set(COOKIE, makeToken(Buffer.from(who).toString("base64url"), MAX_AGE), { ...cookieOpts, maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentAdmin(): Promise<string | null> {
  const p = readToken((await cookies()).get(COOKIE)?.value);
  if (!p) return null;
  const who = Buffer.from(p, "base64url").toString();
  // an emailed admin who was removed from ADMIN_EMAILS loses access at once
  if (who !== "password" && !adminEmails().includes(who)) return null;
  if (who === "password" && !passwordLoginEnabled()) return null;
  return who;
}

export async function isAdmin() {
  return (await currentAdmin()) !== null;
}

/** Call at the top of every admin page and server action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
