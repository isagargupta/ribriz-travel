// The single source of truth for prices. Pure functions only: the browser uses
// them to show prices and the server uses the same code to verify every quote.

export const BOARDS: Record<string, string> = {
  RO: "Room only",
  BB: "Breakfast",
  HB: "Half board",
  FB: "Full board",
  AI: "All inclusive",
};

export const BOARD_DETAIL: Record<string, string> = {
  RO: "No meals included",
  BB: "Breakfast every day",
  HB: "Breakfast and dinner every day",
  FB: "Breakfast, lunch and dinner every day",
  AI: "All meals, snacks and drinks",
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
  { key: "group", label: "Group tours", blurb: "Tour manager, fixed dates", bg: "#cfe9ff", icon: "M3 20v-2a5 5 0 0 1 10 0v2M8 9a3 3 0 1 0 0-.1M14 20v-2a4 4 0 0 1 7-2.6M17 10a2.5 2.5 0 1 0 0-.1" },
  { key: "beach", label: "Beach", blurb: "Seafront, all-inclusive", bg: "#c8f3ff", icon: "M2 18c3-2 5-2 8 0s5 2 8 0 3-1 4 0M12 4v10M12 4c-4 0-7 3-7 5 2-1 5-1 7 0 2-1 5-1 7 0 0-2-3-5-7-5z" },
  { key: "heritage", label: "Heritage", blurb: "Forts, temples, old towns", bg: "#ffdcb8", icon: "M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" },
  { key: "nature", label: "Hills & nature", blurb: "Valleys, lakes, wildlife", bg: "#d4f5e7", icon: "M2 20l7-12 4 6 3-4 6 10z" },
];

/** Extra return-flight cost per adult versus Mumbai, in INR. */
export const FROM_CITIES: Record<string, number> = {
  Mumbai: 0, Delhi: 3000, Bengaluru: 2000, Chennai: 2500, Kolkata: 4000, Ahmedabad: 1500,
  Warsaw: 9000, "Kraków": 9500, Katowice: 9000, "Gdańsk": 10500,
};
export const INDIA_CITIES = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Ahmedabad"];

export type Currency = "INR" | "EUR" | "PLN";
/** Indicative rates: units of the currency one rupee buys. */
export const RATES: Record<Currency, number> = { INR: 1, EUR: 1 / 98.4, PLN: 1 / 23.1 };

export const GST_RATE = 0.05;
export const HOLD_FEE = 2000;
export const DEPOSIT_RATE = 0.1;
export const MIN_DEPOSIT = 5000;
export const HOLD_HOURS = 48;
export const MAX_ADULTS = 9;
export const MAX_CHILDREN = 6;

/* ---------------- formatting ---------------- */

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

/* ---------------- price engine ---------------- */

/** Children pay a share of the adult price, by age on return. */
export function childFactor(age: number) {
  return age < 2 ? 0.1 : age < 6 ? 0.5 : 0.7;
}
export function childBand(age: number) {
  return age < 2 ? "infant, 10%" : age < 6 ? "age 2–5, 50%" : "age 6–11, 70%";
}

export interface QuoteInput {
  /** trip base price per adult, INR */
  base: number;
  /** departure price change, INR */
  delta?: number;
  /** does the price include flights (then the city supplement applies) */
  flight: boolean;
  from?: string;
  adults: number;
  childAges?: number[];
}

export interface QuoteLine { label: string; detail?: string; amount: number }

export interface Quote {
  perAdult: number;
  lines: QuoteLine[];
  subtotal: number;
  gst: number;
  total: number;
  travellers: number;
  /** average per traveller incl. taxes */
  perPerson: number;
  deposit: number;
}

export function citySupplement(flight: boolean, from = "Mumbai") {
  return flight ? FROM_CITIES[from] ?? 0 : 0;
}

/** Per-adult price before taxes. */
export function adultPrice(base: number, delta = 0, flight = false, from = "Mumbai") {
  return Math.max(0, Math.round(base + delta + citySupplement(flight, from)));
}

export function quote(q: QuoteInput): Quote {
  const adults = clampInt(q.adults, 1, MAX_ADULTS);
  const ages = (q.childAges ?? []).slice(0, MAX_CHILDREN).map((a) => clampInt(a, 0, 11));
  const perAdult = adultPrice(q.base, q.delta, q.flight, q.from);
  const lines: QuoteLine[] = [{ label: `${adults} adult${adults > 1 ? "s" : ""}`, detail: `${adults} × per-adult price`, amount: perAdult * adults }];
  ages.forEach((age, i) => lines.push({ label: `Child ${i + 1}`, detail: childBand(age), amount: Math.round(perAdult * childFactor(age)) }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  const travellers = adults + ages.length;
  return {
    perAdult, lines, subtotal, gst, total, travellers,
    perPerson: Math.round(total / travellers),
    deposit: Math.max(MIN_DEPOSIT, Math.round(total * DEPOSIT_RATE)),
  };
}

/** Monthly instalment. 3 and 6 months are no-cost; longer terms at 13% a year. */
export function emi(amount: number, months: number) {
  if (months <= 6) return amount / months;
  const r = 0.13 / 12;
  return (amount * r) / (1 - Math.pow(1 + r, -months));
}

export function savingPct(t: { price: number; was: number | null }) {
  return t.was && t.was > t.price ? Math.round((1 - t.price / t.was) * 100) : 0;
}

export const ratingWord = (r: number) => (r >= 9 ? "Exceptional" : r >= 8.5 ? "Excellent" : r >= 8 ? "Very good" : "Good");

/* ---------------- dates (calendar dates, no time zones) ---------------- */

export function isoDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5);
}
export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return parseISO(s).toLocaleDateString("en-GB", opts);
}

/* ---------------- helpers ---------------- */

export function clampInt(v: unknown, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/** Deterministic 0..1 from a string (FNV-1a). */
export function seeded(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
