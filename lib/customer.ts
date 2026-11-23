import "server-only";
import { cookies } from "next/headers";
import type { Customer } from "@prisma/client";
import { prisma } from "./db";
import { makeToken, readToken } from "./signing";

const COOKIE = "ribriz_user";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function startCustomerSession(customerId: string) {
  (await cookies()).set(COOKIE, makeToken(customerId, MAX_AGE), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export async function endCustomerSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in customer, or null. */
export async function currentCustomer(): Promise<Customer | null> {
  const id = readToken((await cookies()).get(COOKIE)?.value);
  if (!id) return null;
  return prisma.customer.findUnique({ where: { id } });
}
