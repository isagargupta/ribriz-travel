"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentCustomer } from "@/lib/customer";

const profile = z.object({
  name: z.string().trim().max(120),
  phone: z.string().trim().refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "Enter a valid mobile number."),
});

export type ProfileState = { ok?: boolean; error?: string } | undefined;

export async function updateProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const me = await currentCustomer();
  if (!me) redirect("/login?next=/account");
  const p = profile.safeParse({ name: fd.get("name") ?? "", phone: fd.get("phone") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  await prisma.customer.update({ where: { id: me.id }, data: { name: p.data.name || null, phone: p.data.phone || null } });
  revalidatePath("/account");
  return { ok: true };
}
