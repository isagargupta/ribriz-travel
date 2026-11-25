// Pure rules for "live trip" mode: where a traveller is in their trip today,
// and the local facts they need on the ground. No I/O, so it is unit tested.

export type Phase = "planning" | "leaving_soon" | "departure_day" | "on_trip" | "just_back" | "past";

const DAY = 864e5;
const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);

export interface TripClock { phase: Phase; /** 1-based day of the trip while travelling */ day: number | null; totalDays: number; daysToGo: number }

/**
 * A trip of N nights runs N+1 days: day 1 is the departure date, the last day
 * is the flight home. "Leaving soon" is the 3 days before departure, "just
 * back" the 3 days after return.
 */
export function tripClock(today: string, start: string, nights: number): TripClock {
  const totalDays = nights + 1;
  const toGo = days(today, start);
  const day = -toGo + 1;
  const phase: Phase = toGo > 3 ? "planning" : toGo > 0 ? "leaving_soon" : toGo === 0 ? "departure_day"
    : day <= totalDays ? "on_trip" : day <= totalDays + 3 ? "just_back" : "past";
  return { phase, day: phase === "on_trip" || phase === "departure_day" ? day : null, totalDays, daysToGo: toGo };
}

/** Today's and tomorrow's plan from the itinerary (one line per day). */
export function dayPlan(itinerary: string[], day: number | null) {
  if (!day || !itinerary.length) return { today: null, tomorrow: null };
  const pick = (d: number) => (d >= 1 && d <= itinerary.length ? itinerary[d - 1] : null);
  return { today: pick(day), tomorrow: pick(day + 1) };
}

export interface CountryInfo { tz: string; emergency: { label: string; number: string }[]; currency: string; plug: string }

/** Local time zone, emergency numbers, currency and plug type for the countries we sell. */
export const COUNTRY_INFO: Record<string, CountryInfo> = {
  IN: { tz: "Asia/Kolkata", currency: "INR", plug: "C, D, M", emergency: [{ label: "All emergencies", number: "112" }, { label: "Ambulance", number: "108" }] },
  ID: { tz: "Asia/Makassar", currency: "IDR", plug: "C, F", emergency: [{ label: "All emergencies", number: "112" }, { label: "Police", number: "110" }, { label: "Ambulance", number: "118" }] },
  TH: { tz: "Asia/Bangkok", currency: "THB", plug: "A, B, C, O", emergency: [{ label: "Tourist police", number: "1155" }, { label: "Police", number: "191" }, { label: "Ambulance", number: "1669" }] },
  MV: { tz: "Indian/Maldives", currency: "MVR / USD", plug: "C, D, G, J, K, L", emergency: [{ label: "Police", number: "119" }, { label: "Ambulance", number: "102" }] },
  AE: { tz: "Asia/Dubai", currency: "AED", plug: "C, D, G", emergency: [{ label: "Police", number: "999" }, { label: "Ambulance", number: "998" }] },
  JP: { tz: "Asia/Tokyo", currency: "JPY", plug: "A, B", emergency: [{ label: "Police", number: "110" }, { label: "Ambulance & fire", number: "119" }] },
  VN: { tz: "Asia/Ho_Chi_Minh", currency: "VND", plug: "A, C, F", emergency: [{ label: "Police", number: "113" }, { label: "Ambulance", number: "115" }] },
  EG: { tz: "Africa/Cairo", currency: "EGP", plug: "C, F", emergency: [{ label: "Tourist police", number: "126" }, { label: "Police", number: "122" }, { label: "Ambulance", number: "123" }] },
  TR: { tz: "Europe/Istanbul", currency: "TRY", plug: "C, F", emergency: [{ label: "All emergencies", number: "112" }] },
  GR: { tz: "Europe/Athens", currency: "EUR", plug: "C, F", emergency: [{ label: "All emergencies", number: "112" }, { label: "Tourist police", number: "1571" }] },
  CH: { tz: "Europe/Zurich", currency: "CHF", plug: "C, J", emergency: [{ label: "All emergencies", number: "112" }, { label: "Ambulance", number: "144" }] },
  FR: { tz: "Europe/Paris", currency: "EUR", plug: "C, E", emergency: [{ label: "All emergencies", number: "112" }] },
  IT: { tz: "Europe/Rome", currency: "EUR", plug: "C, F, L", emergency: [{ label: "All emergencies", number: "112" }] },
  ES: { tz: "Europe/Madrid", currency: "EUR", plug: "C, F", emergency: [{ label: "All emergencies", number: "112" }] },
};

/** Info for the country the traveller is most likely in: on multi-country trips, the first one. */
export function countryInfo(codes: string[]): (CountryInfo & { code: string }) | null {
  const code = codes.find((c) => COUNTRY_INFO[c]);
  return code ? { code, ...COUNTRY_INFO[code] } : null;
}

/** "+2h 30m" style difference between a time zone and India. */
export function offsetFromIndia(tz: string, at = new Date()): string {
  const mins = (zone: string) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
    const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) / 6e4;
  };
  const d = mins(tz) - mins("Asia/Kolkata");
  if (d === 0) return "same time as India";
  const a = Math.abs(d), h = Math.floor(a / 60), m = a % 60;
  return `${h ? `${h}h` : ""}${h && m ? " " : ""}${m ? `${m}m` : ""} ${d > 0 ? "ahead of" : "behind"} India`;
}

/** Plain-English weather from an Open-Meteo WMO code. */
export function weatherLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear sky", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code <= 48) return { label: "Foggy", icon: "🌫️" };
  if (code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code <= 77) return { label: "Snow", icon: "🌨️" };
  if (code <= 82) return { label: "Showers", icon: "🌦️" };
  if (code <= 86) return { label: "Snow showers", icon: "🌨️" };
  return { label: "Thunderstorms", icon: "⛈️" };
}

/** The short checklist shown in the 3 days before departure. */
export function leavingChecklist(o: { visaNeeded: boolean; hasInsurance: boolean; hasForex: boolean; hasFlights: boolean; international: boolean }) {
  const items = [
    { id: "id", text: o.international ? "Passport (valid 6+ months) and a printed copy" : "Government photo ID (Aadhaar, passport or driving licence)" },
    o.visaNeeded ? { id: "visa", text: "Visa approval, printed and saved offline" } : null,
    o.hasFlights ? { id: "checkin", text: "Online check-in opens 24–48 hours before the flight" } : { id: "flights", text: "Your flight tickets saved offline" },
    { id: "insurance", text: o.hasInsurance ? "Insurance policy number saved" : "Travel insurance: ask Riya to add it" },
    o.international ? { id: "forex", text: o.hasForex ? "Forex card activated, PIN to hand" : "Some local cash or a forex card" } : null,
    { id: "wallet", text: "Tickets and vouchers saved offline in your wallet" },
  ];
  return items.filter((x): x is { id: string; text: string } => !!x);
}
