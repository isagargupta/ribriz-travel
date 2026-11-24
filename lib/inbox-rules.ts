// Ranks the team's work so the most urgent request is always on top, and says
// why and what to do. Pure (no server imports), so it's unit-tested.

/** Office hours in India time: Mon–Sat, 09:00–20:00. */
const OPEN = 9, CLOSE = 20;
const IST = 5.5 * 3600e3;

/** Adds working hours (India office hours) to a moment. */
export function addWorkingHours(from: Date, hours: number): Date {
  let t = from.getTime() + IST; // work in "IST as UTC" so getUTC* reads Indian wall time
  let left = hours * 3600e3;
  for (let guard = 0; guard < 400 && left > 0; guard++) {
    const d = new Date(t);
    const day = d.getUTCDay(), h = d.getUTCHours() + d.getUTCMinutes() / 60;
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (day === 0 || h >= CLOSE) { t = dayStart + 864e5 + OPEN * 3600e3; continue; } // next day's opening
    if (h < OPEN) { t = dayStart + OPEN * 3600e3; continue; }
    const untilClose = dayStart + CLOSE * 3600e3 - t;
    const step = Math.min(left, untilClose);
    t += step; left -= step;
  }
  return new Date(t - IST);
}

/** What we promised customers, in working hours. */
export const SLA_HOURS: Record<string, number> = { hold: 2, visa: 4, forex: 2, insurance: 2, flight: 2, hotel: 2, enquiry: 4, custom: 8 };

export interface WorkInput {
  type: string; status: string; createdAt: Date; quotedTotal: number | null;
  /** departure date YYYY-MM-DD, if known */
  departure: string | null;
  lastTeamMessageAt: Date | null;
  /** an option the traveller chose that isn't booked yet */
  chosenUnbooked: boolean;
  /** options sent and still waiting for the traveller */
  optionsWaiting: boolean;
  /** visa requests: all required documents checked */
  docsReady?: boolean;
}

export interface WorkItem { score: number; level: "urgent" | "today" | "soon" | "fyi"; reasons: string[]; next: string; due: Date | null }

const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600e3;

export function rankWork(w: WorkInput, now: Date): WorkItem | null {
  if (w.status === "closed") return null;
  if (w.status === "booked" && !w.chosenUnbooked) return null;
  const reasons: string[] = [];
  let score = 0, next = "Reply to the customer", due: Date | null = null;

  if (w.chosenUnbooked) {
    score += 100; next = "Book the chosen option and add the confirmation"; reasons.push("Customer chose an option");
  }
  const untouched = w.status === "new" && !w.lastTeamMessageAt;
  if (untouched) {
    due = addWorkingHours(w.createdAt, SLA_HOURS[w.type] ?? 4);
    const late = hoursBetween(due, now);
    if (late > 0) { score += 60 + Math.min(40, late * 4); reasons.push(`Reply overdue by ${late < 1 ? `${Math.max(1, Math.round(late * 60))} min` : `${Math.round(late)} h`}`); }
    else { score += 35 + Math.max(0, 20 - hoursBetween(now, due) * 5); reasons.push("New, not answered yet"); }
    if (w.type === "hold") next = "Confirm the held price with the customer";
  }
  if (w.type === "hold" && w.status !== "booked") {
    const ends = new Date(w.createdAt.getTime() + 48 * 3600e3);
    const left = hoursBetween(now, ends);
    if (left <= 0) { score -= 10; reasons.push("Hold has ended"); next = "Offer to hold again at today's price"; }
    else if (left <= 12) { score += 45; reasons.push(`Hold ends in ${Math.max(1, Math.round(left))} h`); if (!untouched) next = "Take the deposit before the hold ends"; }
  }
  if (w.type === "visa" && w.docsReady && w.status !== "booked") { score += 30; reasons.push("All visa documents checked"); if (!untouched && !w.chosenUnbooked) next = "File the visa application"; }
  if (w.departure) {
    const days = Math.round((Date.parse(w.departure + "T00:00:00+05:30") - now.getTime()) / 864e5);
    if (days >= 0 && days <= 14) { score += 30 - days; reasons.push(days === 0 ? "Leaves today" : `Leaves in ${days} day${days > 1 ? "s" : ""}`); }
  }
  if (w.optionsWaiting && !w.chosenUnbooked) { score -= 15; reasons.push("Options sent, waiting for the customer"); next = "Nudge the customer to choose"; }
  if (!untouched && !w.chosenUnbooked && w.status === "contacted") {
    const quiet = w.lastTeamMessageAt ? hoursBetween(w.lastTeamMessageAt, now) : hoursBetween(w.createdAt, now);
    if (quiet >= 48) { score += 20; reasons.push(`No update for ${Math.round(quiet / 24)} days`); if (next === "Reply to the customer") next = "Send the customer an update"; }
  }
  // replied already and nothing else pressing: the ball is in the customer's court
  if (!untouched && next === "Reply to the customer") {
    if (w.lastTeamMessageAt) reasons.push(`Replied ${hoursBetween(w.lastTeamMessageAt, now) < 24 ? "today" : `${Math.round(hoursBetween(w.lastTeamMessageAt, now) / 24)} days ago`}`);
    next = w.type === "hold" ? "Collect the deposit when the customer confirms" : "Wait for the customer; follow up if no reply in 2 days";
  }
  if (w.quotedTotal && w.quotedTotal > 0) score += Math.min(15, Math.log10(w.quotedTotal) * 2.5);

  const level = score >= 90 ? "urgent" : score >= 50 ? "today" : score >= 20 ? "soon" : "fyi";
  return { score: Math.round(score), level, reasons, next, due };
}
