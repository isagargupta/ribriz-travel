import "server-only";
import { prisma } from "./db";
import { addDays, fmtDate } from "./pricing";
import { completeDetails, type ServiceKind } from "./service-fields";
import { getDepartures, getPublishedTrips } from "./trips";
import { countryName } from "./visa";

/** What the trip already tells us, keyed by the service field names. */
export async function knownDetails(missionId: string | null | undefined): Promise<Record<string, string>> {
  if (!missionId) return {};
  const m = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!m) return {};
  const ages = JSON.parse(m.childAges) as number[];
  const travellers = `${m.adults} adult${m.adults > 1 ? "s" : ""}${ages.length ? `, ${ages.length} child${ages.length > 1 ? "ren" : ""} (age${ages.length > 1 ? "s" : ""} ${ages.join(", ")})` : ""}`;
  const k: Record<string, string> = { travellers, guests: travellers, from: m.fromCity, delivery_city: m.fromCity };
  const trip = m.tripId ? (await getPublishedTrips()).find((t) => t.id === m.tripId) : null;
  if (!trip) return k;
  const countries = trip.countryCodes.filter((c) => c !== m.passport).map(countryName).join(", ") || trip.country;
  Object.assign(k, { countries, destinations: countries, to: trip.dest, city: trip.dest });
  const dep = m.departureId ? (await getDepartures(trip.id)).find((d) => d.id === m.departureId) : null;
  if (dep) {
    const back = addDays(dep.date, trip.nights);
    const long = { day: "numeric", month: "short", year: "numeric" } as const;
    Object.assign(k, {
      travel_dates: `${fmtDate(dep.date, long)} – ${fmtDate(back, long)}`,
      depart_date: fmtDate(dep.date, long), return_date: fmtDate(back, long),
      check_in: fmtDate(dep.date, long), check_out: fmtDate(back, long),
      needed_by: fmtDate(addDays(dep.date, -3), long),
    });
  }
  return k;
}

export class MissingDetails extends Error {
  constructor(public missing: { key: string; hint: string }[]) { super(`Still needed: ${missing.map((m) => m.key).join(", ")}`); }
}

/** Fills a request from the trip and checks nothing required is missing. */
export async function prepareDetails(service: ServiceKind, given: Record<string, string | number | string[]>, missionId?: string | null) {
  const r = completeDetails(service, given, await knownDetails(missionId));
  if (r.missing.length) throw new MissingDetails(r.missing);
  return r.details;
}
