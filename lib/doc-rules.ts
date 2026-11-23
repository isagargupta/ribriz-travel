// Pass/fail rules for uploaded travel documents. Pure, so they're unit-tested.
import * as z from "zod/v4";
import { addMonths, daysBetween, fmtDate, isoDate } from "./pricing.ts";
import { DOC_LABELS, type DocKind } from "./visa-docs.ts";
import { countryName } from "./visa.ts";

const KINDS = ["passport", "photo", "bank_statement", "itr", "employment_proof", "cover_letter", "insurance", "flight_booking", "hotel_booking", "other"] as const;

export const Extract = z.object({
  document_type: z.enum(KINDS),
  readable: z.boolean().describe("Can a visa officer read every important field?"),
  quality_issues: z.array(z.string()).describe("Short, plain issues like 'blurry', 'glare over the name', 'bottom edge cut off', 'too dark'. Empty if fine."),
  passport: z.object({
    expiry_date: z.string().nullable().describe("YYYY-MM-DD from the 'Date of expiry' field"),
    holder_name: z.string().nullable(),
    nationality_code: z.string().nullable().describe("ISO 3166 alpha-2, e.g. IN"),
  }).nullable(),
  photo: z.object({
    plain_light_background: z.boolean(),
    face_centered_and_fully_visible: z.boolean(),
    eyes_open_looking_at_camera: z.boolean(),
    glasses_or_headwear: z.boolean(),
    sharp_and_well_lit: z.boolean(),
  }).nullable(),
  statement: z.object({
    holder_name: z.string().nullable(),
    latest_transaction_date: z.string().nullable().describe("YYYY-MM-DD"),
    months_covered: z.number().nullable(),
  }).nullable(),
  summary: z.string().describe("One sentence describing the document, without any ID numbers."),
});
export type Extracted = z.infer<typeof Extract>;

export interface CheckContext { expectedKind?: DocKind; passport: string; returnDate: string | null; strict: boolean }
export interface CheckResult { kind: DocKind; status: "ok" | "issue" | "unreadable"; findings: string[]; keep: Record<string, string> }

/** Turns what Claude saw into a verdict with traveller-friendly findings. Pure. */
export function judge(x: Extracted, ctx: CheckContext, today = isoDate(new Date())): CheckResult {
  const kind = (x.document_type === "other" && ctx.expectedKind ? ctx.expectedKind : x.document_type) as DocKind;
  const findings: string[] = [];
  const keep: Record<string, string> = {};
  let problem = false;

  if (!x.readable) return { kind, status: "unreadable", findings: ["We couldn't read this clearly. Please upload a sharper photo or scan in good light, with all four corners visible."], keep };
  for (const q of x.quality_issues.slice(0, 3)) { findings.push(`Quality: ${q}.`); problem = true; }
  if (ctx.expectedKind && ctx.expectedKind !== kind && x.document_type !== "other") {
    findings.push(`This looks like a ${DOC_LABELS[kind].toLowerCase()}, not a ${DOC_LABELS[ctx.expectedKind].toLowerCase()}. We've filed it as ${DOC_LABELS[kind].toLowerCase()}.`);
  }

  if (kind === "passport" && x.passport) {
    const exp = x.passport.expiry_date;
    if (x.passport.holder_name) keep.holder_name = x.passport.holder_name;
    if (exp && /^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      keep.expiry = exp;
      const mustLast = addMonths(ctx.returnDate ?? today, 6);
      if (exp < today) { findings.push(`Your passport expired on ${fmtDate(exp, { day: "numeric", month: "short", year: "numeric" })}. You'll need to renew it before applying.`); problem = true; }
      else if (exp < mustLast) {
        findings.push(`It expires on ${fmtDate(exp, { day: "numeric", month: "short", year: "numeric" })}, but most countries need it valid until at least ${fmtDate(mustLast, { day: "numeric", month: "short", year: "numeric" })} (6 months after you return). Please renew it first.`);
        problem = true;
      } else findings.push(`Valid until ${fmtDate(exp, { day: "numeric", month: "short", year: "numeric" })}, comfortably beyond 6 months after your trip.`);
    } else { findings.push("We couldn't read the expiry date. Please upload the full photo page."); problem = true; }
    if (x.passport.nationality_code && x.passport.nationality_code.toUpperCase() !== ctx.passport) {
      findings.push(`This is a ${countryName(x.passport.nationality_code.toUpperCase())} passport; your trip is planned for a ${countryName(ctx.passport)} passport. Tell Riya if you're travelling on this one.`);
    }
  }

  if (kind === "photo" && x.photo) {
    const p = x.photo;
    if (!p.plain_light_background) { findings.push("Background should be plain white or light grey."); problem = true; }
    if (!p.face_centered_and_fully_visible) { findings.push("Face should be centred and fully visible, ears to chin."); problem = true; }
    if (!p.eyes_open_looking_at_camera) { findings.push("Eyes should be open, looking straight at the camera."); problem = true; }
    if (p.glasses_or_headwear) { findings.push("Remove glasses and headwear (religious headwear is fine if the face is fully visible)."); problem = true; }
    if (!p.sharp_and_well_lit) { findings.push("Photo should be sharp and evenly lit, without shadows."); problem = true; }
    if (!problem) findings.push("Looks right for most visa applications.");
  }

  if (kind === "bank_statement" && x.statement) {
    const last = x.statement.latest_transaction_date;
    if (last && /^\d{4}-\d{2}-\d{2}$/.test(last)) {
      const age = daysBetween(last, today);
      if (age > 30) { findings.push(`The latest entry is from ${fmtDate(last, { day: "numeric", month: "short", year: "numeric" })}. Consulates want statements less than a month old.`); problem = true; }
    }
    const months = x.statement.months_covered;
    if (ctx.strict && months !== null && months < 3) { findings.push(`It covers about ${months} month${months === 1 ? "" : "s"}; embassy visas usually need 3–6 months.`); problem = true; }
    if (!problem) findings.push("Recent and covers enough months.");
  }

  if (!findings.length) findings.push(x.summary);
  return { kind, status: problem ? "issue" : "ok", findings, keep };
}
