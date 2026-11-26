// Monthly climate from daily weather history, and which months are best to visit.
// Pure (no server imports), so it's unit-tested.

export interface MonthClimate { month: number; high: number; low: number; rainMm: number; rainyDays: number; score: number; verdict: "best" | "good" | "ok" | "avoid" }

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * How pleasant a month is for a holiday, 0–100: daytime highs of 22–31°C are
 * ideal, colder or hotter costs points (heat over 36°C a lot), and rain costs
 * points above 80 mm a month. (Monthly totals, not rainy-day counts: weather
 * reanalysis over-counts light drizzle in the tropics.)
 */
export function monthScore(high: number, rainMm: number): number {
  const t = high >= 22 && high <= 31 ? 0 : high < 22 ? (22 - high) * 3.5 : (high - 31) * (high > 36 ? 9 : 5);
  const r = Math.max(0, rainMm - 80) * 0.2;
  return Math.max(0, Math.min(100, Math.round(100 - t - r)));
}

/** Averages daily history (several years) into twelve months and rates each. */
export function climateByMonth(d: { time: string[]; tmax: (number | null)[]; tmin: (number | null)[]; rain: (number | null)[] }): MonthClimate[] {
  const acc = Array.from({ length: 12 }, () => ({ hi: 0, lo: 0, n: 0, rain: 0, wet: 0, years: new Set<string>() }));
  d.time.forEach((t, i) => {
    const m = Number(t.slice(5, 7)) - 1, hi = d.tmax[i], lo = d.tmin[i], r = d.rain[i];
    if (hi == null || lo == null) return;
    const a = acc[m];
    a.hi += hi; a.lo += lo; a.n++; a.rain += r ?? 0; if ((r ?? 0) > 1) a.wet++; a.years.add(t.slice(0, 4));
  });
  const rows = acc.map((a, m) => {
    const y = Math.max(1, a.years.size), high = a.n ? a.hi / a.n : 0, rainyDays = a.wet / y;
    const rainMm = a.rain / y;
    return { month: m + 1, high: Math.round(high), low: Math.round(a.n ? a.lo / a.n : 0), rainMm: Math.round(rainMm), rainyDays: Math.round(rainyDays), score: monthScore(high, rainMm) };
  });
  const top = Math.max(...rows.map((r) => r.score));
  return rows.map((r) => ({ ...r, verdict: r.score >= Math.max(70, top - 8) ? "best" : r.score >= 60 ? "good" : r.score >= 40 ? "ok" : "avoid" }));
}

/** "October to March" style ranges for a set of months (wrapping round the year). */
export function monthRanges(months: number[]): string {
  if (!months.length) return "";
  if (months.length === 12) return "all year round";
  const set = new Set(months);
  const starts = months.filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  return starts.map((s) => {
    let e = s;
    while (set.has(e === 12 ? 1 : e + 1) && (e === 12 ? 1 : e + 1) !== s) e = e === 12 ? 1 : e + 1;
    return s === e ? MONTHS_LONG[s - 1] : `${MONTHS_LONG[s - 1]} to ${MONTHS_LONG[e - 1]}`;
  }).join(" and ");
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
