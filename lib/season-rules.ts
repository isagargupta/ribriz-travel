// Departure dates for a season. Pure (no server imports), so it's unit-tested.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");

export interface SeasonInput {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD, inclusive
  /** days of the week to depart, 0 = Sunday … 6 = Saturday; empty = use `every` */
  weekdays: number[];
  /** one departure every N days from `from`, used when no weekdays are picked */
  every?: number;
  /** skip dates before this (e.g. the first sellable date) */
  notBefore?: string;
}

/** The dates a season produces, at most 400 (about 13 months of daily departures). */
export function seasonDates(s: SeasonInput): string[] {
  const start = parse(s.notBefore && s.notBefore > s.from ? s.notBefore : s.from), end = parse(s.to);
  if (!(start <= end)) return [];
  const out: string[] = [];
  const every = Math.max(1, Math.min(60, Math.round(s.every ?? 7)));
  const first = parse(s.from);
  for (let d = new Date(start); d <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    const ok = s.weekdays.length ? s.weekdays.includes(d.getUTCDay()) : Math.round((d.getTime() - first.getTime()) / 864e5) % every === 0;
    if (ok) out.push(iso(d));
  }
  return out;
}

export type BulkAction = "set_delta" | "add_delta" | "set_seats" | "close" | "open" | "delete";

/** What a bulk change does to one departure; null = delete. Dates with bookings are never deleted. */
export function applyBulk(d: { priceDelta: number; seatsLeft: number | null; status: string; booked: boolean }, action: BulkAction, value: number | null):
  { priceDelta: number; seatsLeft: number | null; status: string } | null | "keep" {
  switch (action) {
    case "set_delta": return { ...d, priceDelta: Math.round(value ?? 0) };
    case "add_delta": return { ...d, priceDelta: d.priceDelta + Math.round(value ?? 0) };
    case "set_seats": return { ...d, seatsLeft: value === null ? null : Math.max(0, Math.round(value)) };
    case "close": return { ...d, status: "closed" };
    case "open": return { ...d, status: "open" };
    case "delete": return d.booked ? "keep" : null;
  }
}
