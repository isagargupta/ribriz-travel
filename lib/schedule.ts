// Builds a departure calendar for a trip with seasonal pricing.
// Pure: used by the seed script and the admin "generate dates" tool.
import { addDays, parseISO, seeded } from "./pricing.ts";

export interface PlannedDeparture { date: string; priceDelta: number; seatsLeft: number | null }

export interface ScheduleOptions {
  tripId: string;
  kind: string;
  /** base price per adult, INR */
  base: number;
  /** first possible date, YYYY-MM-DD */
  start: string;
  /** how far ahead to plan */
  days: number;
  /** days between departures; defaults by trip type */
  every?: number;
  /** seats per departure for limited trips; defaults by trip type */
  seats?: number | null;
  lastMinute?: boolean;
}

const DEFAULT_EVERY: Record<string, number> = { escorted: 10, cruise: 7, package: 3, hotel: 2 };

/** Price multiplier from season, weekday and a stable bit of variation. */
export function priceFactor(date: string, key: string, daysOut: number, lastMinute = false) {
  const d = parseISO(date);
  const m = d.getMonth() + 1, day = d.getDate(), wd = d.getDay();
  let f = 0;
  if ((m === 12 && day >= 20) || (m === 1 && day <= 5)) f += 0.15;      // year-end peak
  else if (m === 5 || m === 6) f += 0.08;                                // summer holidays
  else if (m === 10 && day >= 15) f += 0.06;                             // Diwali season
  else if (m === 7 || m === 8 || (m === 9 && day < 15)) f -= 0.05;       // monsoon low season
  if (wd === 5 || wd === 6) f += 0.05;                                   // Fri/Sat starts
  f += (seeded(key + date) - 0.5) * 0.08;                                // ±4% variation
  if (lastMinute && daysOut <= 21) f -= 0.05;
  return f;
}

export function buildSchedule(o: ScheduleOptions): PlannedDeparture[] {
  const every = Math.max(1, o.every ?? DEFAULT_EVERY[o.kind] ?? 3);
  const seats = o.seats !== undefined ? o.seats : o.kind === "escorted" ? 30 : null;
  // start a stable offset in so different trips don't all leave on the same day
  const offset = Math.floor(seeded(o.tripId) * every);
  const out: PlannedDeparture[] = [];
  for (let i = offset + 2; i <= o.days; i += every) {
    const date = addDays(o.start, i);
    const delta = Math.round((o.base * priceFactor(date, o.tripId, i, o.lastMinute)) / 100) * 100;
    const seatsLeft = seats === null ? null : Math.max(2, Math.round(seats * (0.25 + seeded(o.tripId + "s" + date) * 0.75)));
    out.push({ date, priceDelta: delta, seatsLeft });
  }
  return out;
}
