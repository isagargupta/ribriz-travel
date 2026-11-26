import "server-only";
import { unstable_cache } from "next/cache";
import { climateByMonth, monthRanges, slugify, type MonthClimate } from "./climate-rules";
import { COORDS } from "./live";
import { adultPrice } from "./pricing";
import { getPublishedTrips } from "./trips";
import type { TripDTO } from "./types";
import { PROCESSING_DAYS, VISA_META, countryName, type VisaCategory } from "./visa";
import { getVisaRules } from "./visa-data";

export interface Destination {
  slug: string; name: string; country: string; region: string; image: string;
  countryCodes: string[]; trips: TripDTO[]; fromPrice: number; nights: [number, number];
}

/** One destination per distinct trip destination on sale, with its trips and starting price. */
export async function getDestinations(): Promise<Destination[]> {
  const trips = await getPublishedTrips();
  const by = new Map<string, TripDTO[]>();
  for (const t of trips) by.set(t.dest, [...(by.get(t.dest) ?? []), t]);
  return [...by.entries()].map(([name, ts]) => ({
    slug: slugify(name), name, country: ts[0].country, region: ts[0].region, image: ts[0].image,
    countryCodes: [...new Set(ts.flatMap((t) => t.countryCodes))], trips: ts,
    fromPrice: Math.min(...ts.map((t) => adultPrice(t.price, t.minDelta, t.flight, "Mumbai"))),
    nights: [Math.min(...ts.map((t) => t.nights)), Math.max(...ts.map((t) => t.nights))] as [number, number],
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDestination(slug: string) {
  return (await getDestinations()).find((d) => d.slug === slug) ?? null;
}

/**
 * Ten years of daily weather history (Open-Meteo archive, free) averaged into
 * months, and the best and worst months to go. Cached for 30 days.
 */
export const climateFor = unstable_cache(
  async (name: string, country: string | null): Promise<{ months: MonthClimate[]; best: string; avoid: string } | null> => {
    let c: [number, number] | null = COORDS[name] ?? null;
    if (!c) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1${country ? `&countryCode=${country}` : ""}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null);
      c = g?.results?.[0] ? [g.results[0].latitude, g.results[0].longitude] : null;
    }
    if (!c) return null;
    const end = new Date().getUTCFullYear() - 1;
    const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${c[0]}&longitude=${c[1]}&start_date=${end - 9}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!r?.ok) return null;
    const j = await r.json();
    const months = climateByMonth({ time: j.daily.time, tmax: j.daily.temperature_2m_max, tmin: j.daily.temperature_2m_min, rain: j.daily.precipitation_sum });
    return { months, best: monthRanges(months.filter((m) => m.verdict === "best").map((m) => m.month)), avoid: monthRanges(months.filter((m) => m.verdict === "avoid").map((m) => m.month)) };
  },
  ["climate-v1"],
  { revalidate: 30 * 86400 },
);

/** What an Indian passport needs for each country of the destination. */
export async function visaForIndians(codes: string[]) {
  const rules = await getVisaRules("IN");
  return codes.filter((c) => c !== "IN").map((c) => {
    const cat = (rules.find((r) => r.d === c)?.c ?? "required") as VisaCategory;
    return { code: c, country: countryName(c), category: cat, label: VISA_META[cat].label, blurb: VISA_META[cat].blurb, days: rules.find((r) => r.d === c)?.days ?? null, processing: PROCESSING_DAYS[cat] };
  });
}
