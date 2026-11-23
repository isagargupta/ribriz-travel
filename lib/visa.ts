// Visa categories and helpers shared by the browser and the server. Pure.
import { COUNTRY_NAMES } from "./country-names.ts";

export type VisaCategory = "visa_free" | "voa" | "eta" | "evisa" | "required" | "own" | "no_entry";

export interface VisaRuleDTO { d: string; c: VisaCategory; days: number | null }

export const VISA_META: Record<VisaCategory, { label: string; short: string; tone: "good" | "ok" | "warn" | "bad" | "neutral"; blurb: string; order: number }> = {
  visa_free: { label: "Visa-free", short: "Visa-free", tone: "good", order: 1, blurb: "No visa needed. Carry a passport valid for at least 6 months, a return ticket and hotel booking." },
  voa:       { label: "Visa on arrival", short: "On arrival", tone: "good", order: 2, blurb: "Get your visa at the airport when you land. Keep cash for the fee, photos, hotel booking and return ticket handy." },
  eta:       { label: "eTA (online authorisation)", short: "eTA", tone: "ok", order: 3, blurb: "Apply online before you fly. Usually approved within minutes to a few days; much simpler than a full visa." },
  evisa:     { label: "e-Visa", short: "e-Visa", tone: "ok", order: 4, blurb: "Apply online before you fly; no embassy visit. Allow 3–10 working days. We can apply for you." },
  required:  { label: "Visa required", short: "Visa needed", tone: "warn", order: 5, blurb: "Apply through the embassy or a visa centre before you travel, often with an appointment. Start 4–8 weeks ahead. We can help." },
  own:       { label: "Your own country", short: "Home", tone: "neutral", order: 6, blurb: "No visa needed: this is your own country." },
  no_entry:  { label: "Entry restricted", short: "Restricted", tone: "bad", order: 7, blurb: "Entry is currently restricted for this passport. Contact us before planning." },
};

/** Turns a raw dataset value into a category and day count. */
export function parseRequirement(raw: string): { category: VisaCategory; days: number | null } {
  const v = raw.trim().toLowerCase();
  if (/^\d+$/.test(v)) return { category: "visa_free", days: Number(v) };
  if (v === "-1") return { category: "own", days: null };
  if (v === "visa free") return { category: "visa_free", days: null };
  if (v === "visa on arrival") return { category: "voa", days: null };
  if (v === "eta") return { category: "eta", days: null };
  if (v === "e-visa") return { category: "evisa", days: null };
  if (v === "visa required") return { category: "required", days: null };
  return { category: "no_entry", days: null }; // covid ban, no admission, anything unexpected
}

/** "Visa-free · 60 days", "e-Visa", … */
export function visaLine(r: Pick<VisaRuleDTO, "c" | "days">) {
  return VISA_META[r.c].label + (r.days ? ` · up to ${r.days} days` : "");
}

/** Visa-free, on arrival, eTA and e-Visa all count as easy: no embassy visit. */
export const isEasy = (c: VisaCategory) => c === "visa_free" || c === "voa" || c === "eta" || c === "evisa" || c === "own";

/** Same name on the server and in every browser (Intl names differ between them). */
export function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}

/** 🇮🇳 from "IN" (regional indicator symbols, no image assets). */
export function flag(code: string) {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "🏳️";
}

export const DEFAULT_PASSPORT = "IN";
