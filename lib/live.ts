import "server-only";
import { prisma } from "./db";
import { countryInfo, dayPlan, leavingChecklist, offsetFromIndia, tripClock, weatherLabel, type Phase } from "./live-rules";
import { OFFER_LABEL } from "./offers";
import { ownedBy, type Owner } from "./owner";
import { addDays } from "./pricing";
import { getTripsForTravellers } from "./trips";
import { countryName } from "./visa";

export interface Weather { now: number; max: number; min: number; rain: number | null; label: string; icon: string; tomorrow: { max: number; min: number; label: string; icon: string } | null }
export interface LiveTrip {
  missionId: string; title: string; dest: string; image: string; slug: string;
  phase: Phase; day: number | null; totalDays: number; daysToGo: number; date: string; returnDate: string;
  today: string | null; tomorrow: string | null;
  country: string | null; countryName: string | null; tz: string; offset: string; currency: string | null; plug: string | null;
  emergency: { label: string; number: string }[];
  weather: Weather | null;
  bookings: { label: string; title: string; confirmation: string }[];
  checklist: { id: string; text: string }[];
}

/** Where to look up the weather for each destination we sell. Other trips fall back to geocoding. */
export const COORDS: Record<string, [number, number]> = {
  Bali: [-8.65, 115.22], Kerala: [9.93, 76.27], Europe: [46.69, 7.86], Japan: [35.68, 139.69], Dubai: [25.2, 55.27],
  Kashmir: [34.08, 74.8], Maldives: [4.17, 73.51], Thailand: [7.88, 98.39], Crete: [35.34, 25.13], Rajasthan: [26.91, 75.79],
  Egypt: [27.26, 33.81], Goa: [15.5, 73.83], Mediterranean: [41.39, 2.17], Vietnam: [21.03, 105.85], Andaman: [11.62, 92.73], Antalya: [36.9, 30.7],
};

async function coords(dest: string, country: string | null): Promise<[number, number] | null> {
  if (COORDS[dest]) return COORDS[dest];
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(dest)}&count=1${country ? `&countryCode=${country}` : ""}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return j.results?.[0] ? [j.results[0].latitude, j.results[0].longitude] : null;
  } catch { return null; }
}

/** Current weather and today/tomorrow's forecast from Open-Meteo (free, no key). Cached for 30 minutes. */
async function weather(dest: string, country: string | null): Promise<Weather | null> {
  const c = await coords(dest, country);
  if (!c) return null;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=2`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j.daily;
    const w = weatherLabel(j.current.weather_code);
    const t = d.time.length > 1 ? weatherLabel(d.weather_code[1]) : null;
    return {
      now: Math.round(j.current.temperature_2m), max: Math.round(d.temperature_2m_max[0]), min: Math.round(d.temperature_2m_min[0]),
      rain: d.precipitation_probability_max?.[0] ?? null, ...w,
      tomorrow: t ? { max: Math.round(d.temperature_2m_max[1]), min: Math.round(d.temperature_2m_min[1]), ...t } : null,
    };
  } catch { return null; }
}

const localDate = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD

const LIVE: Phase[] = ["leaving_soon", "departure_day", "on_trip"];

/** The traveller's trips that are about to start or are happening now, with everything they need on the ground. */
export async function liveTrips(owner: Owner): Promise<LiveTrip[]> {
  const missions = await prisma.mission.findMany({
    where: { AND: [ownedBy(owner), { status: { not: "cancelled" }, tripId: { not: null }, departureId: { not: null } }] },
    include: { tasks: { select: { kind: true, status: true } } }, take: 20,
  });
  if (!missions.length) return [];
  const [trips, deps] = await Promise.all([
    getTripsForTravellers(),
    // the traveller's own departure, even once it's in the past or closed for sale
    prisma.departure.findMany({ where: { id: { in: missions.map((m) => m.departureId!) } }, select: { id: true, date: true } }),
  ]);
  const out: LiveTrip[] = [];
  for (const m of missions) {
    const t = trips.find((x) => x.id === m.tripId);
    const dep = deps.find((d) => d.id === m.departureId);
    if (!t || !dep) continue;
    const info = countryInfo(t.countryCodes);
    const tz = info?.tz ?? "Asia/Kolkata";
    const clock = tripClock(localDate(tz), dep.date, t.nights);
    if (!LIVE.includes(clock.phase)) continue;

    const offers = await prisma.serviceOffer.findMany({ where: { missionId: m.id, status: "booked" }, orderBy: { createdAt: "asc" } });
    const task = (k: string) => m.tasks.find((x) => x.kind === k)?.status;
    const has = (svc: string, k: string) => offers.some((o) => o.service === svc) || task(k) === "done";
    const international = t.countryCodes.some((c) => c !== "IN");
    out.push({
      missionId: m.id, title: t.title, dest: t.dest, image: t.image, slug: t.slug,
      ...clock, date: dep.date, returnDate: addDays(dep.date, t.nights),
      ...dayPlan(t.days, clock.day),
      country: info?.code ?? null, countryName: info ? countryName(info.code) : null, tz, offset: offsetFromIndia(tz), currency: info?.currency ?? null, plug: info?.plug ?? null,
      emergency: info?.emergency ?? [{ label: "All emergencies", number: "112" }],
      weather: clock.phase === "leaving_soon" && clock.daysToGo > 1 ? null : await weather(t.dest, info?.code ?? null),
      bookings: offers.filter((o) => o.confirmation).map((o) => ({ label: OFFER_LABEL[o.service] ?? o.service, title: o.title, confirmation: o.confirmation! })),
      checklist: leavingChecklist({
        visaNeeded: !!task("visa") && task("visa") !== "skipped", international,
        hasInsurance: has("insurance", "insurance"), hasForex: has("forex", "forex"), hasFlights: t.flight || has("flight", "flights"),
      }),
    });
  }
  return out.sort((a, b) => a.daysToGo - b.daysToGo);
}
