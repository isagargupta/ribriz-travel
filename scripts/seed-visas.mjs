// Starting catalogue of visas for Indian passport holders. Fees are estimates in
// INR (converted from the official currency) and every product starts
// "not verified": check each one against the official source in /admin/visas.
// Run: node scripts/seed-visas.mjs   (adds missing products, never overwrites)
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const D = (kind, label, note) => ({ kind, label, ...(note ? { note } : {}) });
const PASSPORT = D("passport", "Passport: front and back pages", "Valid for 6 months after your return, with 2 blank pages");
const PHOTO = D("photo", "Passport-size photo", "Recent, white background, no glasses");
const FLIGHT = D("flight_booking", "Return flight booking");
const HOTEL = D("hotel_booking", "Hotel booking for the whole stay");
const BANK = D("bank_statement", "Bank statements, last 6 months", "Stamped or downloaded from net banking");
const ITR = D("itr", "Income tax returns, last 3 years");
const JOB = D("employment_proof", "Job proof", "Leave letter and salary slips, or business registration");
const COVER = D("cover_letter", "Cover letter", "Who's travelling, why, dates and who pays: we can draft it for you");
const INS = D("insurance", "Travel insurance", "Medical cover of at least €30,000 for Schengen");

const SCHENGEN = (code, dest, popular) => ({
  slug: `${dest}-schengen-tourist`, countryCode: code, destSlug: dest, name: "Schengen Tourist Visa (Type C)", kind: "sticker", entries: "multiple",
  validityDays: 90, stayDays: 90, processingDays: 15, needsAppointment: true, govtFee: 10900, serviceFee: 2499, popular,
  docs: [PASSPORT, PHOTO, BANK, ITR, JOB, COVER, FLIGHT, HOTEL, INS],
  notes: "Fee covers the €90 visa fee and the VFS service charge.\nYou give fingerprints at the visa centre; we book the appointment and prepare your file.\nOne Schengen visa covers France, Italy, Switzerland, Spain, Greece and the other Schengen countries.",
});

const PRODUCTS = [
  { slug: "dubai-30-day-tourist", countryCode: "AE", destSlug: "dubai", name: "30-day Tourist e-Visa", kind: "evisa", entries: "single", validityDays: 58, stayDays: 30, processingDays: 3, govtFee: 6500, serviceFee: 999, popular: true, order: 1, docs: [PASSPORT, PHOTO], notes: "Indians with a valid US visa or green card, or a UK or EU residence permit, may get a visa on arrival instead." },
  { slug: "dubai-60-day-tourist", countryCode: "AE", destSlug: "dubai", name: "60-day Tourist e-Visa", kind: "evisa", entries: "single", validityDays: 58, stayDays: 60, processingDays: 3, govtFee: 11500, serviceFee: 999, order: 2, docs: [PASSPORT, PHOTO] },
  { slug: "singapore-tourist-evisa", countryCode: "SG", destSlug: "singapore", name: "Tourist e-Visa", kind: "evisa", entries: "multiple", validityDays: 30, stayDays: 30, processingDays: 5, govtFee: 2500, serviceFee: 999, popular: true, order: 3, docs: [PASSPORT, PHOTO, FLIGHT, HOTEL, BANK], notes: "Indian passport holders apply through a Singapore-authorised visa agent; we handle this for you." },
  { slug: "vietnam-evisa-single", countryCode: "VN", destSlug: "vietnam", name: "e-Visa, single entry (90 days)", kind: "evisa", entries: "single", validityDays: 90, stayDays: 90, processingDays: 4, govtFee: 2200, serviceFee: 999, popular: true, order: 4, docs: [PASSPORT, PHOTO] },
  { slug: "vietnam-evisa-multiple", countryCode: "VN", destSlug: "vietnam", name: "e-Visa, multiple entry (90 days)", kind: "evisa", entries: "multiple", validityDays: 90, stayDays: 90, processingDays: 4, govtFee: 4400, serviceFee: 999, order: 5, docs: [PASSPORT, PHOTO] },
  { slug: "indonesia-evoa", countryCode: "ID", destSlug: "indonesia", name: "e-Visa on Arrival (30 days)", kind: "evisa", entries: "single", validityDays: 90, stayDays: 30, processingDays: 2, govtFee: 2700, serviceFee: 799, popular: true, order: 6, docs: [PASSPORT, FLIGHT], notes: "Covers Bali. Extendable once for another 30 days inside Indonesia.\nSkip the visa-on-arrival queue at the airport." },
  { slug: "japan-tourist-evisa", countryCode: "JP", destSlug: "japan", name: "Tourist e-Visa (single entry)", kind: "evisa", entries: "single", validityDays: 90, stayDays: 90, processingDays: 6, govtFee: 1800, serviceFee: 1499, popular: true, order: 7, docs: [PASSPORT, PHOTO, BANK, ITR, JOB, COVER, FLIGHT, HOTEL], notes: "Indian residents apply for Japan's e-Visa through an accredited agency; we prepare and submit your file." },
  { ...SCHENGEN("FR", "france", true), order: 8 },
  { ...SCHENGEN("CH", "switzerland", true), order: 9 },
  { ...SCHENGEN("IT", "italy", false), order: 20 },
  { ...SCHENGEN("ES", "spain", false), order: 21 },
  { ...SCHENGEN("GR", "greece", false), order: 22 },
  { slug: "uk-standard-visitor", countryCode: "GB", destSlug: "united-kingdom", name: "Standard Visitor visa (6 months)", kind: "sticker", entries: "multiple", validityDays: 180, stayDays: 180, processingDays: 15, needsAppointment: true, govtFee: 15000, serviceFee: 2499, popular: true, order: 10, docs: [PASSPORT, PHOTO, BANK, ITR, JOB, COVER, HOTEL], notes: "You give fingerprints at the visa centre; we fill the online form and book the appointment." },
  { slug: "usa-b1b2-visitor", countryCode: "US", destSlug: "united-states", name: "B1/B2 Visitor visa", kind: "sticker", entries: "multiple", validityDays: 3650, stayDays: 180, processingDays: 30, needsAppointment: true, govtFee: 16000, serviceFee: 2999, order: 11, docs: [PASSPORT, PHOTO, BANK, ITR, JOB], notes: "Includes the DS-160 form, appointment booking and interview preparation.\nInterview waiting times vary a lot by city: apply months ahead." },
  { slug: "australia-visitor-600", countryCode: "AU", destSlug: "australia", name: "Visitor visa (subclass 600)", kind: "evisa", entries: "multiple", validityDays: 365, stayDays: 90, processingDays: 20, govtFee: 11000, serviceFee: 1999, order: 12, docs: [PASSPORT, PHOTO, BANK, ITR, JOB, COVER], notes: "Granted electronically; you may be asked to give fingerprints at a visa centre." },
  { slug: "egypt-tourist-evisa", countryCode: "EG", destSlug: "egypt", name: "Tourist e-Visa (single entry)", kind: "evisa", entries: "single", validityDays: 90, stayDays: 30, processingDays: 5, govtFee: 2200, serviceFee: 999, order: 13, docs: [PASSPORT, PHOTO, HOTEL] },
  { slug: "turkiye-evisa", countryCode: "TR", destSlug: "turkiye", name: "e-Visa (with a valid US, UK or Schengen visa)", kind: "evisa", entries: "single", validityDays: 180, stayDays: 30, processingDays: 2, govtFee: 4500, serviceFee: 999, order: 14, docs: [PASSPORT, D("other", "Your valid US, UK, Schengen or Irish visa or residence permit"), HOTEL, FLIGHT], notes: "Only for travellers holding a valid US, UK, Schengen or Irish visa or residence permit. Otherwise a sticker visa is needed: ask Riya." },
  { slug: "azerbaijan-asan-evisa", countryCode: "AZ", destSlug: "azerbaijan", name: "ASAN e-Visa (30 days)", kind: "evisa", entries: "single", validityDays: 90, stayDays: 30, processingDays: 3, govtFee: 2300, serviceFee: 799, order: 15, docs: [PASSPORT, PHOTO] },
  { slug: "sri-lanka-eta", countryCode: "LK", destSlug: "sri-lanka", name: "ETA (tourist, 30 days)", kind: "eta", entries: "double", validityDays: 180, stayDays: 30, processingDays: 2, govtFee: 0, serviceFee: 499, order: 16, docs: [PASSPORT, FLIGHT, HOTEL], notes: "Sri Lanka has waived the ETA fee for Indian passport holders at times; we charge only our fee and confirm the current rule when we file." },
  { slug: "thailand-tdac", countryCode: "TH", destSlug: "thailand", name: "Visa-free entry + Digital Arrival Card", kind: "visa_free", entries: "single", validityDays: null, stayDays: 60, processingDays: 1, govtFee: 0, serviceFee: 499, order: 17, docs: [PASSPORT, FLIGHT, HOTEL], notes: "Indians can visit Thailand visa-free for short stays. Everyone must file the Thailand Digital Arrival Card (TDAC) within 3 days before arrival: we file it for your whole group." },
  { slug: "malaysia-mdac", countryCode: "MY", destSlug: "malaysia", name: "Visa-free entry + Digital Arrival Card", kind: "visa_free", entries: "single", validityDays: null, stayDays: 30, processingDays: 1, govtFee: 0, serviceFee: 499, order: 18, docs: [PASSPORT, FLIGHT, HOTEL], notes: "Indians can visit Malaysia visa-free for up to 30 days. The Malaysia Digital Arrival Card (MDAC) is filed within 3 days before arrival: we do it for you." },
  { slug: "maldives-arrival", countryCode: "MV", destSlug: "maldives", name: "Free visa on arrival (30 days)", kind: "arrival", entries: "single", validityDays: null, stayDays: 30, processingDays: 0, govtFee: 0, serviceFee: 0, order: 19, docs: [], notes: "Nothing to apply for: you get 30 days free on arrival with a return ticket and a confirmed hotel.\nFill in the free IMUGA traveller declaration within 96 hours of your flight." },
];

let added = 0;
for (const [i, x] of PRODUCTS.entries()) {
  const exists = await p.visaProduct.findUnique({ where: { slug: x.slug } });
  if (exists) continue;
  await p.visaProduct.create({ data: { order: x.order ?? 50 + i, popular: !!x.popular, ...x, docs: JSON.stringify(x.docs), verifiedAt: null } });
  added++;
}
console.log(`Added ${added} visa products (${PRODUCTS.length} in the starting catalogue). Verify fees in /admin/visas.`);
await p.$disconnect();
