// Traveller preferences: shape, merging and safety rules. Pure, so it's tested
// and shared by Riya's memory tool, the /you page and the recommender.
import { z } from "zod";

export const THEME_KEYS = ["honeymoon", "family", "group", "beach", "heritage", "nature", "city", "luxury"] as const;
export const REGIONS = ["India", "South-East Asia", "East Asia", "Middle East", "Indian Ocean", "Europe", "Mediterranean", "Africa", "Americas", "Oceania"] as const;
export const PACES = ["relaxed", "balanced", "packed"] as const;
export const TRAVELS_WITH = ["solo", "couple", "family with kids", "friends", "parents"] as const;

const short = z.string().trim().min(1).max(40);
export const PrefsSchema = z.object({
  likes: z.array(z.enum(THEME_KEYS)).max(8).optional(),
  avoid: z.array(short).max(8).optional(),
  regions: z.array(z.enum(REGIONS)).max(6).optional(),
  budgetPerAdult: z.number().int().min(5000).max(2_000_000).nullable().optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  pace: z.enum(PACES).nullable().optional(),
  travelsWith: z.enum(TRAVELS_WITH).nullable().optional(),
  dietary: z.string().trim().max(60).nullable().optional(),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export interface Note { id: string; text: string; at: string }
export const MAX_NOTES = 20;

const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Applies a change: lists are replaced when given, null clears a field. */
export function mergePrefs(base: Prefs, patch: Prefs): Prefs {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || (Array.isArray(v) && v.length === 0)) delete out[k];
    else out[k] = Array.isArray(v) ? uniq<unknown>(v) : v;
  }
  return PrefsSchema.parse(out);
}

/** Combines a browser profile into an account profile on sign-in: the account wins, lists are unioned. */
export function combinePrefs(account: Prefs, browser: Prefs): Prefs {
  const out: Prefs = { ...browser, ...account };
  for (const k of ["likes", "avoid", "regions", "months"] as const) {
    const merged = uniq([...((account[k] as unknown[]) ?? []), ...((browser[k] as unknown[]) ?? [])]);
    if (merged.length) (out as Record<string, unknown>)[k] = merged.slice(0, k === "months" ? 12 : 8);
  }
  return PrefsSchema.parse(out);
}

/**
 * Notes must be about travel taste, never identity documents or money details.
 * Long digit runs (passport, card, phone, account numbers) and emails are refused.
 */
export function cleanNote(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 160);
  if (t.length < 3) return null;
  if (/\d[\d\s-]{6,}\d/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\b[A-Z]\d{7}\b/.test(t)) return null;
  return t;
}

export function addNote(notes: Note[], text: string, id: string, at: string): Note[] {
  const t = cleanNote(text);
  if (!t) return notes;
  const rest = notes.filter((n) => n.text.toLowerCase() !== t.toLowerCase());
  return [{ id, text: t, at }, ...rest].slice(0, MAX_NOTES);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: number) => MONTHS[m - 1];

/** One line per fact, for Riya's context and the /you page. */
export function describePrefs(p: Prefs): string[] {
  const l: string[] = [];
  if (p.travelsWith) l.push(`Usually travels: ${p.travelsWith}`);
  if (p.likes?.length) l.push(`Likes: ${p.likes.join(", ")} trips`);
  if (p.regions?.length) l.push(`Favourite regions: ${p.regions.join(", ")}`);
  if (p.budgetPerAdult) l.push(`Budget: about ₹${p.budgetPerAdult.toLocaleString("en-IN")} per adult`);
  if (p.months?.length) l.push(`Likes to travel in: ${[...p.months].sort((a, b) => a - b).map(monthName).join(", ")}`);
  if (p.pace) l.push(`Pace: ${p.pace}`);
  if (p.dietary) l.push(`Food: ${p.dietary}`);
  if (p.avoid?.length) l.push(`Avoid: ${p.avoid.join(", ")}`);
  return l;
}
