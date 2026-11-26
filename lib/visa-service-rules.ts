// Visa service rules: price, estimated delivery date and application stages.
// Pure (no server imports), so it's unit-tested.

export type VisaKind = "evisa" | "sticker" | "eta" | "arrival" | "visa_free";
export const VISA_KIND_LABEL: Record<VisaKind, string> = { evisa: "e-Visa", sticker: "Sticker visa", eta: "ETA", arrival: "Visa on arrival", visa_free: "Visa-free" };

/** GST on our service fee (visa facilitation). The government fee is collected and paid on the traveller's behalf, without GST. */
export const SERVICE_GST = 0.18;

export interface PriceInput { govtFee: number; serviceFee: number }
export interface VisaPrice { govt: number; service: number; gst: number; perPerson: number; travellers: number; total: number }

export function visaPrice(p: PriceInput, travellers = 1): VisaPrice {
  const n = Math.max(1, Math.min(9, Math.round(travellers)));
  const gst = Math.round(p.serviceFee * SERVICE_GST);
  const perPerson = p.govtFee + p.serviceFee + gst;
  return { govt: p.govtFee, service: p.serviceFee, gst, perPerson, travellers: n, total: perPerson * n };
}

/** Adds working days (Mon–Fri) to a date. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.ceil(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * When the visa should be ready if they apply now: one working day for our
 * document check and filing, plus the destination's processing time.
 * Applications after 4pm India time start the next day.
 */
export function visaReadyBy(now: Date, processingDays: number): string {
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + (ist.getUTCHours() >= 16 ? 1 : 0)));
  return addWorkingDays(start, 1 + processingDays).toISOString().slice(0, 10);
}

/** Is there time to get it before they fly? "tight" when ready less than 3 days before departure. */
export function deadlineCheck(readyBy: string, departure: string | null): "ok" | "tight" | "late" | null {
  if (!departure) return null;
  const gap = (Date.parse(departure) - Date.parse(readyBy)) / 864e5;
  return gap < 0 ? "late" : gap < 3 ? "tight" : "ok";
}

/** Where an application is. The traveller sees these as a timeline. */
export const STAGES = [
  { key: "documents", label: "Documents", hint: "Upload passport and photo for each traveller" },
  { key: "payment", label: "Payment", hint: "Pay the visa and service fee" },
  { key: "review", label: "Expert check", hint: "Our visa team checks everything before filing" },
  { key: "submitted", label: "Filed", hint: "Submitted to the embassy or government portal" },
  { key: "approved", label: "Visa issued", hint: "Your visa is ready to download" },
] as const;
export type Stage = (typeof STAGES)[number]["key"] | "rejected" | "cancelled";

export const stageIndex = (s: Stage) => (s === "rejected" || s === "cancelled" ? -1 : STAGES.findIndex((x) => x.key === s));

/** The next stage from the facts: documents first, then payment, then the team takes it from there. */
export function autoStage(cur: Stage, o: { docsComplete: boolean; paid: boolean }): Stage {
  if (cur === "submitted" || cur === "approved" || cur === "rejected" || cur === "cancelled") return cur;
  if (o.paid) return cur === "review" ? "review" : o.docsComplete ? "review" : "documents";
  return o.docsComplete ? "payment" : "documents";
}
