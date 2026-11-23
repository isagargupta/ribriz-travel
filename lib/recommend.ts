// "For you": ranks trips for one traveller from what they told Riya and what
// they did on the site, and says why in a few words. Pure and deterministic.
import type { Prefs } from "./profile-rules.ts";
import { monthName } from "./profile-rules.ts";

export interface RecTrip {
  id: string; dest: string; region: string; title: string; themes: string[]; price: number; was: number | null;
  rating: number; depDates: string[]; countryCodes: string[]; lastMinute: boolean;
}
export interface Signals {
  /** recently viewed trip ids, newest first */
  viewed: string[];
  saved: string[];
  /** trips on the traveller's missions or holds: already being handled */
  active: string[];
}
export interface Rec { id: string; score: number; reason: string }

/** Rough non-stop-equivalent flight hours from western India, by region. */
const FLIGHT_HOURS: Record<string, number> = { India: 2, "Middle East": 3.5, "Indian Ocean": 4, "South-East Asia": 4.5, Mediterranean: 7, "East Asia": 8, Africa: 7, Europe: 9.5, Oceania: 12, Americas: 16 };

const fmtL = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : `₹${Math.round(n / 1000)}k`);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Did the traveller give us anything to go on? */
export const hasSignal = (p: Prefs, s: Signals) =>
  !!(p.likes?.length || p.regions?.length || p.budgetPerAdult || p.months?.length || p.travelsWith || s.viewed.length || s.saved.length || s.active.length);

export function recommend(trips: RecTrip[], p: Prefs, s: Signals, opts: { easyVisa?: (countryCodes: string[]) => boolean; limit?: number } = {}): Rec[] {
  if (!hasSignal(p, s)) return [];
  const byId = new Map(trips.map((t) => [t.id, t]));
  const themeW = new Map<string, number>(), regionW = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w);

  // what they said counts most; what they did fades with time
  for (const th of p.likes ?? []) bump(themeW, th, 3);
  for (const r of p.regions ?? []) bump(regionW, r, 3);
  if (p.travelsWith === "family with kids") bump(themeW, "family", 2);
  if (p.travelsWith === "couple") bump(themeW, "honeymoon", 1);
  if (p.travelsWith === "friends") bump(themeW, "group", 1);
  const touched: { t: RecTrip; w: number }[] = [
    ...s.saved.map((id) => ({ t: byId.get(id)!, w: 2 })),
    ...s.active.map((id) => ({ t: byId.get(id)!, w: 1.5 })),
    ...s.viewed.slice(0, 10).map((id, i) => ({ t: byId.get(id)!, w: Math.pow(0.8, i) })),
  ].filter((x) => x.t);
  for (const { t, w } of touched) {
    for (const th of t.themes) bump(themeW, th, w);
    bump(regionW, t.region, w * 0.8);
  }
  const maxT = Math.max(1, ...themeW.values()), maxR = Math.max(1, ...regionW.values());
  const budget = p.budgetPerAdult ?? (touched.length >= 2 ? median(touched.map((x) => x.t.price)) : 0);
  const budgetSaid = !!p.budgetPerAdult;
  const avoid = (p.avoid ?? []).map((a) => a.toLowerCase());
  const exclude = new Set([...s.active, ...s.saved]);
  const recentlySeen = new Set(s.viewed.slice(0, 3));

  type Part = { w: number; why: string };
  const scored = trips.filter((t) => !exclude.has(t.id)).map((t) => {
    const parts: Part[] = [];
    const tAff = t.themes.reduce((a, th) => a + (themeW.get(th) ?? 0), 0) / maxT / Math.sqrt(Math.max(1, t.themes.length));
    if (tAff > 0) {
      const top = [...t.themes].sort((a, b) => (themeW.get(b) ?? 0) - (themeW.get(a) ?? 0))[0];
      const said = p.likes?.includes(top as never);
      const like = touched.find((x) => x.t.themes.includes(top) && x.t.id !== t.id);
      parts.push({ w: 2 * tAff, why: said ? `You love ${top} trips` : like ? `Because you liked ${like.t.dest}` : `Matches your taste for ${top}` });
    }
    const rAff = (regionW.get(t.region) ?? 0) / maxR;
    if (rAff > 0) parts.push({ w: 1.2 * rAff, why: p.regions?.includes(t.region as never) ? `In ${t.region}, a favourite of yours` : `More of ${t.region}` });
    if (budget) {
      const r = t.price / budget;
      if (r <= 1) parts.push({ w: budgetSaid ? 1 : 0.5, why: `Within your ${fmtL(budget)} budget` });
      else if (r <= 1.15) parts.push({ w: 0.1, why: "Just over your budget" });
      else parts.push({ w: -Math.min(3, (r - 1.15) * (budgetSaid ? 6 : 3)), why: "" });
    }
    if (p.months?.length) {
      const m = p.months.find((mm) => t.depDates.some((d) => Number(d.slice(5, 7)) === mm));
      parts.push(m ? { w: 0.8, why: `Has dates in ${monthName(m)}` } : { w: -0.6, why: "" });
    }
    if (opts.easyVisa?.(t.countryCodes)) parts.push({ w: avoid.some((a) => a.includes("visa")) ? 1.2 : 0.35, why: "Easy visa for your passport" });
    const off = t.was && t.was > t.price ? Math.round((1 - t.price / t.was) * 100) : 0;
    if (off >= 12) parts.push({ w: 0.3 + off / 100, why: `${off}% off right now` });
    parts.push({ w: (t.rating - 8) * 0.25, why: t.rating >= 9 ? `Rated ${t.rating.toFixed(1)} by travellers` : "" });
    const text = `${t.title} ${t.dest} ${t.region} ${t.themes.join(" ")}`.toLowerCase();
    if (avoid.some((a) => a.length > 2 && text.includes(a))) parts.push({ w: -4, why: "" });
    const hours = FLIGHT_HOURS[t.region] ?? 6;
    if (avoid.some((a) => a.includes("long flight"))) {
      if (t.region === "India") parts.push({ w: 0.6, why: "No long flight: it's in India" });
      else if (hours <= 5) parts.push({ w: 0.6, why: `Only about ${Math.round(hours)} hours' flight` });
      else parts.push({ w: -Math.min(3, (hours - 5) * 0.7), why: "" });
    }
    if (recentlySeen.has(t.id)) parts.push({ w: -0.6, why: "" });
    if (!t.depDates.length) parts.push({ w: -1, why: "" });
    const reasons = parts.filter((x) => x.why && x.w > 0).sort((a, b) => b.w - a.w).map((x) => x.why);
    return { t, score: parts.reduce((a, x) => a + x.w, 0), reasons: reasons.length ? reasons : ["Popular with travellers like you"] };
  });

  // greedy pick with diversity: repeated regions and destinations count for less
  const picked: Rec[] = [];
  const seenRegion = new Map<string, number>(), seenDest = new Set<string>();
  const pool = [...scored];
  const limit = opts.limit ?? 8;
  while (picked.length < limit && pool.length) {
    let bi = 0, bs = -Infinity;
    pool.forEach((x, i) => {
      const s2 = x.score - 0.7 * (seenRegion.get(x.t.region) ?? 0) - (seenDest.has(x.t.dest) ? 2 : 0);
      if (s2 > bs) { bs = s2; bi = i; }
    });
    const [x] = pool.splice(bi, 1);
    if (bs < -1.5) break; // nothing good left
    // vary the wording: prefer a reason not already shown twice (the strongest still leads)
    const used = (r: string) => picked.filter((q) => q.reason === r).length;
    const reason = x.reasons.find((r) => used(r) < 2) ?? x.reasons[0];
    picked.push({ id: x.t.id, score: +bs.toFixed(3), reason });
    seenRegion.set(x.t.region, (seenRegion.get(x.t.region) ?? 0) + 1);
    seenDest.add(x.t.dest);
  }
  return picked;
}
