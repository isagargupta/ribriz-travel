// What each service request needs, so the team never has to ask the traveller
// again. Pure (no server imports) so it's unit-tested and shared with the tools.

export type ServiceKind = "visa" | "forex" | "insurance" | "flight" | "hotel";

export interface Field { key: string; label: string; required: boolean; hint: string; fallback?: string }

export const SERVICE_FIELDS: Record<ServiceKind, Field[]> = {
  visa: [
    { key: "countries", label: "Countries", required: true, hint: "e.g. Japan" },
    { key: "travel_dates", label: "Travel dates", required: true, hint: "e.g. 30 Nov – 9 Dec 2026" },
    { key: "travellers", label: "Travellers", required: true, hint: "e.g. 2 adults" },
    { key: "purpose", label: "Purpose", required: false, hint: "Tourism, business, family visit", fallback: "Tourism" },
  ],
  forex: [
    { key: "currency", label: "Currency", required: true, hint: "ISO code, e.g. JPY" },
    { key: "amount", label: "Amount", required: true, hint: "in that currency, e.g. 150000" },
    { key: "form", label: "Card or cash", required: true, hint: "card, cash, or card and cash" },
    { key: "delivery_city", label: "Delivery city", required: true, hint: "where to deliver" },
    { key: "needed_by", label: "Needed by", required: false, hint: "date" },
  ],
  insurance: [
    { key: "destinations", label: "Destinations", required: true, hint: "countries" },
    { key: "travel_dates", label: "Travel dates", required: true, hint: "start – end" },
    { key: "traveller_ages", label: "Traveller ages", required: true, hint: "e.g. 34, 31, 5" },
    { key: "medical_conditions", label: "Medical conditions", required: false, hint: "anything pre-existing they mentioned", fallback: "None mentioned" },
  ],
  flight: [
    { key: "from", label: "From", required: true, hint: "city" },
    { key: "to", label: "To", required: true, hint: "city" },
    { key: "depart_date", label: "Depart", required: true, hint: "date" },
    { key: "return_date", label: "Return", required: false, hint: "date, or one-way", fallback: "One-way" },
    { key: "travellers", label: "Travellers", required: true, hint: "e.g. 2 adults, 1 child (5)" },
    { key: "cabin", label: "Cabin", required: false, hint: "Economy, Premium economy, Business", fallback: "Economy" },
    { key: "preferences", label: "Preferences", required: false, hint: "non-stop, times, airline" },
  ],
  hotel: [
    { key: "city", label: "City", required: true, hint: "city or area" },
    { key: "check_in", label: "Check-in", required: true, hint: "date" },
    { key: "check_out", label: "Check-out", required: true, hint: "date" },
    { key: "rooms", label: "Rooms", required: true, hint: "number" },
    { key: "guests", label: "Guests", required: true, hint: "e.g. 2 adults" },
    { key: "budget_per_night", label: "Budget per night", required: false, hint: "INR" },
    { key: "preferences", label: "Preferences", required: false, hint: "area, stars, breakfast" },
  ],
};

type Value = string | number | string[];
const filled = (v: unknown) => v !== undefined && v !== null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && !v.length);

/**
 * Merges what the traveller told Riya over what we already know from their trip,
 * applies defaults, and lists what's still missing. Unknown keys are kept (as
 * extra notes) but can't stand in for a required field.
 */
export function completeDetails(service: ServiceKind, given: Record<string, Value>, known: Record<string, Value> = {}) {
  const fields = SERVICE_FIELDS[service];
  const details: Record<string, Value> = {};
  for (const f of fields) {
    const v = filled(given[f.key]) ? given[f.key] : filled(known[f.key]) ? known[f.key] : f.fallback;
    if (filled(v)) details[f.key] = v!;
  }
  for (const [k, v] of Object.entries(given)) if (!(k in details) && filled(v)) details[k] = v;
  const missing = fields.filter((f) => f.required && !filled(details[f.key])).map((f) => ({ key: f.key, hint: f.hint }));
  return { details, missing };
}

/** Labels in field order for cards, emails and the admin. */
export function detailLines(service: string, details: Record<string, unknown>): string[] {
  const fields = SERVICE_FIELDS[service as ServiceKind] ?? [];
  const known = new Set(fields.map((f) => f.key));
  const fmtV = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));
  return [
    ...fields.filter((f) => filled(details[f.key])).map((f) => `${f.label}: ${fmtV(details[f.key])}`),
    ...Object.entries(details).filter(([k, v]) => !known.has(k) && filled(v)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${fmtV(v)}`),
  ];
}
