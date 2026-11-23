// Client-safe constants and price maths shared by every page.
import type { TripDTO } from "./types";

export const BOARDS: Record<string, string> = {
  RO: "Room only",
  BB: "Breakfast",
  HB: "Half board",
  FB: "Full board",
  AI: "All inclusive",
};

export const KINDS: Record<string, string> = {
  package: "Flight + hotel",
  escorted: "Group tour",
  hotel: "Hotel only",
  cruise: "Cruise",
};

export const THEMES: { key: string; label: string; blurb: string; bg: string; icon: string }[] = [
  { key: "honeymoon", label: "Honeymoon", blurb: "Private villas, couple extras", bg: "#ffd6c9", icon: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" },
  { key: "family", label: "Family", blurb: "Kids' clubs, big rooms", bg: "#ffe7a1", icon: "M8 7a2 2 0 1 0 0-.1M16 7a2 2 0 1 0 0-.1M5 20v-6l3-4 3 4v6M13 20v-5l3-4 3 4v5" },
  { key: "group", label: "Group tours", bg: "#cfe9ff", blurb: "Tour manager, fixed dates", icon: "M3 20v-2a5 5 0 0 1 10 0v2M8 9a3 3 0 1 0 0-.1M14 20v-2a4 4 0 0 1 7-2.6M17 10a2.5 2.5 0 1 0 0-.1" },
  { key: "beach", label: "Beach", blurb: "Seafront, all-inclusive", bg: "#c8f3ff", icon: "M2 18c3-2 5-2 8 0s5 2 8 0 3-1 4 0M12 4v10M12 4c-4 0-7 3-7 5 2-1 5-1 7 0 2-1 5-1 7 0 0-2-3-5-7-5z" },
  { key: "heritage", label: "Heritage", blurb: "Forts, temples, old towns", bg: "#ffdcb8", icon: "M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" },
  { key: "nature", label: "Hills & nature", blurb: "Valleys, lakes, wildlife", bg: "#d4f5e7", icon: "M2 20l7-12 4 6 3-4 6 10z" },
];

/** Extra flight cost per person versus Mumbai, in INR. */
export const FROM_CITIES: Record<string, number> = {
  Mumbai: 0, Delhi: 3000, Bengaluru: 2000, Chennai: 2500, Kolkata: 4000, Ahmedabad: 1500,
  Warsaw: 9000, "Kraków": 9500, Katowice: 9000, "Gdańsk": 10500,
};

export type Currency = "INR" | "EUR" | "PLN";
/** Indicative rates: how many units of the currency one rupee buys. */
export const RATES: Record<Currency, number> = { INR: 1, EUR: 1 / 98.4, PLN: 1 / 23.1 };

export const GST = 0.05;
export const HOLD_FEE = 2000;

export function fmt(inr: number, cur: Currency = "INR"): string {
  const v = Math.round(inr * RATES[cur]);
  if (cur === "INR") return "₹" + v.toLocaleString("en-IN");
  if (cur === "EUR") return "€" + v.toLocaleString("de-DE");
  return v.toLocaleString("pl-PL") + " zł";
}

export function fmtK(inr: number, cur: Currency = "INR"): string {
  const v = inr * RATES[cur];
  const k = v >= 10000 ? Math.round(v / 1000) + "k" : (v / 1000).toFixed(1) + "k";
  return cur === "PLN" ? k + " zł" : (cur === "INR" ? "₹" : "€") + k;
}

export const ppPrice = (t: Pick<TripDTO, "price" | "flight">, from = "Mumbai") =>
  t.price + (t.flight ? FROM_CITIES[from] ?? 0 : 0);

export const childFactor = (age: number) => (age < 2 ? 0.1 : age < 6 ? 0.5 : 0.7);

export function groupTotal(pp: number, adults: number, childAges: number[]) {
  const base = pp * adults + childAges.reduce((a, age) => a + pp * childFactor(age), 0);
  const gst = base * GST;
  return { base, gst, total: base + gst };
}

/** 3 and 6 months are no-cost; longer terms at 13% a year. */
export function emi(amount: number, months: number) {
  if (months <= 6) return amount / months;
  const r = 0.13 / 12;
  return (amount * r) / (1 - Math.pow(1 + r, -months));
}

export const savingPct = (t: Pick<TripDTO, "price" | "was">) =>
  t.was ? Math.round((1 - t.price / t.was) * 100) : 0;

/** Deterministic 0..1 from a string; used for sample departure dates. */
export function seeded(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export interface Departure { date: string; adj: number; seats: number | null }

/** Upcoming departures for a trip, starting from `fromDate` (YYYY-MM-DD). */
export function departures(t: TripDTO, fromDate: string, from = "Mumbai"): Departure[] {
  const base = new Date(fromDate + "T00:00:00");
  const out: Departure[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + 3 + i * (t.kind === "escorted" ? 9 : 4) + Math.floor(seeded(t.id + i) * 3));
    out.push({
      date: isoDate(d),
      adj: Math.round(((seeded(t.id + "p" + i) - 0.4) * 0.12 * ppPrice(t, from)) / 100) * 100,
      seats: t.kind === "escorted" ? 2 + Math.floor(seeded(t.id + "s" + i) * 14) : null,
    });
  }
  return out;
}

export function isoDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const ratingWord = (r: number) => (r >= 9 ? "Exceptional" : r >= 8.5 ? "Excellent" : "Very good");
