// GST rules for Ribriz's tax invoices. Pure (no server imports), so it's unit-tested.
// Amounts are in paise (integers) to avoid rounding drift.

/** GST state codes (first two digits of a GSTIN; also used for place of supply). */
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Normalises and checks a GSTIN: format, a real state code, and the check digit. */
export function checkGstin(raw: string): { ok: true; gstin: string; stateCode: string } | { ok: false; error: string } {
  const g = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, error: "That doesn't look like a GSTIN (15 characters, e.g. 29AANCR5772Q1Z6)." };
  if (!STATE_CODES[g.slice(0, 2)]) return { ok: false, error: "The first two digits aren't a valid GST state code." };
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  if (CHARS[(36 - (sum % 36)) % 36] !== g[14]) return { ok: false, error: "That GSTIN's check digit doesn't match. Please check it for typos." };
  return { ok: true, gstin: g, stateCode: g.slice(0, 2) };
}

/** Indian financial year of a date (April to March), e.g. "2026-27". */
export function financialYear(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600e3); // the date in India
  const y = ist.getUTCFullYear(), start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Document number: at most 16 characters, unique and consecutive within the financial year. */
export function docNumber(kind: "invoice" | "credit_note", fy: string, seq: number): string {
  return `${kind === "invoice" ? "RB" : "CN"}/${fy}/${String(seq).padStart(4, "0")}`;
}

export interface TaxSplit { taxable: number; cgst: number; sgst: number; igst: number; total: number; rate: number; intraState: boolean }

/**
 * Splits a GST-inclusive amount (paise) into taxable value and tax. Within the
 * supplier's state it's CGST + SGST (half each); across states it's IGST.
 */
export function splitTax(totalPaise: number, ratePct: number, intraState: boolean): TaxSplit {
  const taxable = Math.round((totalPaise * 100) / (100 + ratePct));
  const tax = totalPaise - taxable;
  const cgst = intraState ? Math.floor(tax / 2) : 0;
  return { taxable, cgst, sgst: intraState ? tax - cgst : 0, igst: intraState ? 0 : tax, total: totalPaise, rate: ratePct, intraState };
}

/**
 * Place of supply for tour operator services: the buyer's state when they give
 * a GSTIN (business), otherwise the supplier's state, as we hold no address
 * for consumers.
 */
export function placeOfSupply(supplierState: string, buyerGstin: string | null | undefined): { code: string; name: string } {
  const code = buyerGstin && checkGstin(buyerGstin).ok ? buyerGstin.slice(0, 2) : supplierState;
  return { code, name: STATE_CODES[code] ?? code };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");

/** "Rupees One Lakh Seventeen Thousand Eight Hundred Ten and Fifty Paise Only" (Indian grouping). */
export function amountInWords(paise: number): string {
  const r = Math.floor(paise / 100), ps = paise % 100;
  const parts: string[] = [];
  const crore = Math.floor(r / 1e7), lakh = Math.floor((r % 1e7) / 1e5), thousand = Math.floor((r % 1e5) / 1000), rest = r % 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  const rupees = parts.length ? parts.join(" ") : "Zero";
  return `Rupees ${rupees}${ps ? ` and ${two(ps)} Paise` : ""} Only`;
}

/** ₹1,17,810.50 */
export const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
