import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Staff } from "@prisma/client";
import { adminEmails, currentAdmin } from "./auth";
import { prisma } from "./db";
import { can, type Perm, type Role } from "./staff-rules";

export const PASSWORD_ADMIN = "admin@password.local";

/** May this email sign in to the admin? Owners from ADMIN_EMAILS, or an active employee. */
export async function isStaffEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (adminEmails().includes(e)) return true;
  return !!(await prisma.staff.findFirst({ where: { email: e, active: true }, select: { id: true } }));
}

/**
 * The signed-in employee (created on first sign-in for owners from ADMIN_EMAILS
 * and for the shared password login). Null when signed out or deactivated.
 */
export const currentStaff = cache(async (): Promise<(Staff & { role: Role }) | null> => {
  const who = await currentAdmin();
  if (!who) return null;
  const email = who === "password" ? PASSWORD_ADMIN : who;
  let s = await prisma.staff.findUnique({ where: { email } });
  const envOwner = who === "password" || adminEmails().includes(email);
  if (!s && envOwner) s = await prisma.staff.create({ data: { email, name: who === "password" ? "Admin" : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), role: "owner", takesNew: false } });
  if (!s || (!s.active && !envOwner)) return null;
  if (envOwner && s.role !== "owner") s = await prisma.staff.update({ where: { id: s.id }, data: { role: "owner" } });
  if (!s.lastSeenAt || Date.now() - s.lastSeenAt.getTime() > 5 * 60e3) await prisma.staff.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return s as Staff & { role: Role };
});

/** For admin pages and actions: the employee, who must be allowed to do `perm`. */
export async function requireStaff(perm: Perm = "work") {
  const s = await currentStaff();
  if (!s) redirect("/admin/login");
  if (!can(s.role, perm)) redirect("/admin?denied=" + perm);
  return s;
}

export const staffCan = (s: { role: string }, perm: Perm) => can(s.role as Role, perm);
