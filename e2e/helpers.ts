import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import type { BrowserContext } from "@playwright/test";

/** Everything the browser tests create uses this email (or a TST reference) so teardown can find it. */
export const TEST_EMAIL = "e2e-traveller@example.com";
export const BASE = "http://localhost:3200";
export const STATE = "e2e/.state.json";

export const prisma = new PrismaClient();

export function env(): Record<string, string> {
  return Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
}
export const sign = (v: string) => createHmac("sha256", env().SESSION_SECRET).update(v).digest("base64url");
export function token(payload: string, hours = 6) {
  const exp = String(Date.now() + hours * 3600e3);
  return `${payload}.${exp}.${sign(`${payload}.${exp}`)}`;
}
export const state = (): { customerId: string; customer: string; admin: string } => JSON.parse(fs.readFileSync(STATE, "utf8"));

export async function signIn(ctx: BrowserContext, as: "customer" | "admin") {
  const s = state();
  await ctx.addCookies([{ name: as === "admin" ? "ribriz_admin" : "ribriz_user", value: as === "admin" ? s.admin : s.customer, url: BASE }]);
}

/** A fully paid holiday for the test traveller, as if Razorpay had confirmed it. */
export async function paidHoliday(ref: string, billing: { billingName?: string; billingGstin?: string; billingAddress?: string } = {}) {
  const trip = (await prisma.trip.findUnique({ where: { slug: "dubai-abu-dhabi-5n" } }))!;
  const e = await prisma.enquiry.create({ data: { ref, type: "hold", name: "E2E Traveller", phone: "0", email: TEST_EMAIL, tripId: trip.id, tripTitle: trip.title, departure: "2027-02-01", adults: 2, quotedTotal: 117810, status: "booked", message: "E2E", ...billing } });
  await prisma.payment.create({ data: { enquiryId: e.id, kind: "full", amount: 117810, orderId: `order_E2E_${ref}`, paymentId: `pay_E2E_${ref}`, status: "paid", method: "upi", paidAt: new Date() } });
  return e;
}
