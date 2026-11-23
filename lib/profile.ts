import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import type { Owner } from "./owner";
import { PrefsSchema, addNote, combinePrefs, mergePrefs, type Note, type Prefs } from "./profile-rules";

/**
 * Riya's memory of a traveller. Keyed by account when signed in, otherwise by
 * browser; on sign-in the browser's memory is folded into the account.
 */
export interface Profile { prefs: Prefs; notes: Note[]; updatedAt: string | null }
const EMPTY: Profile = { prefs: {}, notes: [], updatedAt: null };

const keyOf = (o: Owner) => (o.customerId ? { customerId: o.customerId } : o.anonId ? { anonId: o.anonId } : null);
const parse = (r: { prefs: string; notes: string; updatedAt: Date }): Profile => {
  const p = PrefsSchema.safeParse(JSON.parse(r.prefs));
  return { prefs: p.success ? p.data : {}, notes: JSON.parse(r.notes) as Note[], updatedAt: r.updatedAt.toISOString() };
};

export async function getProfile(owner: Owner): Promise<Profile> {
  const key = keyOf(owner);
  if (!key) return EMPTY;
  const r = await prisma.travellerProfile.findUnique({ where: key });
  return r ? parse(r) : EMPTY;
}

export interface ProfileChange { set?: Prefs; note?: string; forgetNote?: string; forgetKeys?: (keyof Prefs)[] }

/** Applies a change and returns what's stored now, plus whether a note was refused. */
export async function updateProfile(owner: Owner, c: ProfileChange) {
  const key = keyOf(owner);
  if (!key) throw new Error("No traveller to remember for.");
  const cur = await getProfile(owner);
  let prefs = c.set ? mergePrefs(cur.prefs, c.set) : cur.prefs;
  if (c.forgetKeys?.length) prefs = mergePrefs(prefs, Object.fromEntries(c.forgetKeys.map((k) => [k, null])) as Prefs);
  let notes = cur.notes;
  let refused = false;
  if (c.note) {
    const next = addNote(notes, c.note, randomBytes(6).toString("hex"), new Date().toISOString());
    refused = next === notes;
    notes = next;
  }
  if (c.forgetNote) {
    const f = c.forgetNote.toLowerCase();
    notes = notes.filter((n) => n.id !== c.forgetNote && !n.text.toLowerCase().includes(f));
  }
  const data = { prefs: JSON.stringify(prefs), notes: JSON.stringify(notes) };
  const r = await prisma.travellerProfile.upsert({ where: key, update: data, create: { ...key, ...data } });
  return { profile: parse(r), refused };
}

export async function forgetEverything(owner: Owner) {
  const or = [owner.customerId && { customerId: owner.customerId }, owner.anonId && { anonId: owner.anonId }].filter(Boolean) as object[];
  if (or.length) await prisma.travellerProfile.deleteMany({ where: { OR: or } });
}

/** On sign-in: the browser's memory joins the account's (account wins on conflicts). */
export async function claimBrowserProfile(customerId: string, anonId: string) {
  const anon = await prisma.travellerProfile.findUnique({ where: { anonId } });
  if (!anon) return;
  const acct = await prisma.travellerProfile.findUnique({ where: { customerId } });
  if (!acct) {
    await prisma.travellerProfile.update({ where: { id: anon.id }, data: { customerId, anonId: null } });
    return;
  }
  const a = parse(acct), b = parse(anon);
  const notes = [...a.notes, ...b.notes.filter((n) => !a.notes.some((x) => x.text.toLowerCase() === n.text.toLowerCase()))].slice(0, 20);
  await prisma.$transaction([
    prisma.travellerProfile.update({ where: { id: acct.id }, data: { prefs: JSON.stringify(combinePrefs(a.prefs, b.prefs)), notes: JSON.stringify(notes) } }),
    prisma.travellerProfile.delete({ where: { id: anon.id } }),
  ]);
}
