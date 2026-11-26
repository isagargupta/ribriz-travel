// What travellers typically need to provide for a visa, by visa type, with
// extras for common destinations. Planning guidance, not legal advice: the
// visa team confirms the final list with the consulate.
import type { VisaCategory } from "./visa.ts";

export type DocKind =
  | "passport" | "photo" | "bank_statement" | "itr" | "employment_proof" | "cover_letter"
  | "insurance" | "flight_booking" | "hotel_booking" | "visa_issued" | "other";

export const DOC_LABELS: Record<DocKind, string> = {
  passport: "Passport (photo page)",
  photo: "Passport-size photo",
  bank_statement: "Bank statements (last 3–6 months)",
  itr: "Income tax returns (last 2–3 years)",
  employment_proof: "Employment or business proof",
  cover_letter: "Cover letter",
  insurance: "Travel insurance certificate",
  flight_booking: "Flight booking",
  hotel_booking: "Hotel booking",
  visa_issued: "Issued visa",
  other: "Other document",
};

/** Documents Ribriz produces itself once the trip is held/booked. */
export const RIBRIZ_PROVIDES: DocKind[] = ["flight_booking", "hotel_booking"];

export interface DocRequirement { kind: DocKind; label: string; why: string; required: boolean; byRibriz?: boolean }

const SCHENGEN = new Set(["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"]);

function req(kind: DocKind, why: string, required = true, byRibriz = false): DocRequirement {
  return { kind, label: DOC_LABELS[kind], why, required, byRibriz };
}

/**
 * Document list for a trip. `needs` holds the visa category per destination
 * country (ISO code) for the traveller's passport.
 */
export function requirementsFor(needs: { country: string; cat: VisaCategory }[]): DocRequirement[] {
  const cats = new Set(needs.map((n) => n.cat));
  const countries = new Set(needs.map((n) => n.country));
  const schengen = needs.some((n) => SCHENGEN.has(n.country) && n.cat === "required");
  const out = new Map<DocKind, DocRequirement>();
  const add = (r: DocRequirement) => { if (!out.has(r.kind) || (r.required && !out.get(r.kind)!.required)) out.set(r.kind, r); };

  if (cats.size === 0 || [...cats].every((c) => c === "own")) return [];

  // every international trip
  add(req("passport", "Must be valid for at least 6 months after you return, with 2 blank pages."));

  if (cats.has("voa") || cats.has("visa_free")) {
    add(req("photo", "Some airports ask for a photo at the visa-on-arrival desk.", false));
    add(req("hotel_booking", "Shown at immigration as proof of stay.", true, true));
    add(req("flight_booking", "Return ticket shown at immigration.", true, true));
  }
  if (cats.has("eta") || cats.has("evisa")) {
    add(req("photo", "Uploaded with the online application: recent, plain light background, face clearly visible."));
    add(req("hotel_booking", "Asked for on most e-visa forms.", true, true));
    add(req("flight_booking", "Asked for on most e-visa forms.", true, true));
  }
  if (cats.has("evisa")) {
    add(req("bank_statement", "Some e-visas ask for proof of funds.", false));
  }
  if (cats.has("required")) {
    add(req("photo", "Usually 2 recent photos to the consulate's size (often 35×45 mm), white background."));
    add(req("bank_statement", "Last 3–6 months, stamped, showing enough money for the trip."));
    add(req("itr", "Last 2–3 years' ITR acknowledgements, to show ties to India."));
    add(req("employment_proof", "Leave letter from employer, or business registration and GST certificate if self-employed."));
    add(req("cover_letter", "Explains your trip and who pays. We can draft it for you.", true));
    add(req("hotel_booking", "Confirmed stay for every night.", true, true));
    add(req("flight_booking", "Return flight reservation.", true, true));
  }
  if (schengen) add(req("insurance", "Schengen requires medical cover of at least €30,000 for the whole trip."));
  if (countries.has("JP")) add(req("bank_statement", "Japan's e-visa asks for recent bank statements.", true));
  if (countries.has("AE")) add(req("photo", "UAE e-visa needs a colour photo with white background.", true));

  const order: DocKind[] = ["passport", "photo", "bank_statement", "itr", "employment_proof", "cover_letter", "insurance", "flight_booking", "hotel_booking"];
  return [...out.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
