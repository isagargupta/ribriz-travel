import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "./db";
import { DATA_VERSION, TRIPS_TAG } from "./trips";
import { DEFAULT_PASSPORT, isEasy, parseRequirement, type VisaCategory, type VisaRuleDTO } from "./visa";

export const VISA_TAG = "visa";
const SOURCE_CSV = "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso2.csv";
const SOURCE_COMMITS = "https://api.github.com/repos/ilyankou/passport-index-dataset/commits?per_page=1";

/** All destination rules for one passport, sorted by destination code. */
export const getVisaRules = unstable_cache(
  async (passport: string): Promise<VisaRuleDTO[]> => {
    const rows = await prisma.visaRule.findMany({ where: { passport }, orderBy: { destination: "asc" } });
    return rows.map((r) => ({ d: r.destination, c: r.category as VisaCategory, days: r.days }));
  },
  [`visa-rules-v${DATA_VERSION}`],
  { tags: [VISA_TAG], revalidate: 86400 },
);

export const getPassports = unstable_cache(
  async (): Promise<string[]> => (await prisma.visaRule.findMany({ distinct: ["passport"], select: { passport: true }, orderBy: { passport: "asc" } })).map((r) => r.passport),
  [`visa-passports-v${DATA_VERSION}`],
  { tags: [VISA_TAG], revalidate: 86400 },
);

/** Last refresh info. Dates are ISO strings: the cache stores JSON, which has no Date type. */
export const getVisaSync = unstable_cache(
  async (): Promise<{ sourceDate: string; syncedAt: string; rows: number } | null> => {
    const s = await prisma.visaSync.findUnique({ where: { id: 1 } });
    return s ? { sourceDate: s.sourceDate.toISOString(), syncedAt: s.syncedAt.toISOString(), rows: s.rows } : null;
  },
  [`visa-sync-v${DATA_VERSION}`],
  { tags: [VISA_TAG], revalidate: 86400 },
);

/** Downloads the dataset and replaces the stored rules. Safe to run any time. */
export async function syncVisaData(): Promise<{ rows: number; sourceDate: string }> {
  const [csvRes, commitRes] = await Promise.all([
    fetch(SOURCE_CSV, { cache: "no-store" }),
    fetch(SOURCE_COMMITS, { cache: "no-store", headers: { Accept: "application/vnd.github+json", "User-Agent": "ribriz-visa-sync" } }),
  ]);
  if (!csvRes.ok) throw new Error(`Visa data download failed (${csvRes.status})`);
  const csv = await csvRes.text();
  let sourceDate = new Date();
  try { sourceDate = new Date((await commitRes.json())[0].commit.committer.date); } catch { /* keep now */ }

  const rows = csv.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const [passport, destination, ...rest] = line.split(",");
    const raw = rest.join(",").trim();
    const { category, days } = parseRequirement(raw);
    return { passport: passport.trim(), destination: destination.trim(), raw, category, days };
  }).filter((r) => /^[A-Z]{2}$/.test(r.passport) && /^[A-Z]{2}$/.test(r.destination));

  // sanity check: never wipe good data with a broken download
  if (rows.length < 10000 || !rows.some((r) => r.passport === DEFAULT_PASSPORT)) throw new Error(`Visa data looks incomplete (${rows.length} rows); kept the old data.`);

  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 4000) chunks.push(rows.slice(i, i + 4000));
  await prisma.$transaction([
    prisma.visaRule.deleteMany(),
    ...chunks.map((data) => prisma.visaRule.createMany({ data })),
    prisma.visaSync.upsert({ where: { id: 1 }, update: { sourceDate, syncedAt: new Date(), rows: rows.length }, create: { id: 1, sourceDate, syncedAt: new Date(), rows: rows.length } }),
  ]);

  await refreshEasyVisaFlags();
  return { rows: rows.length, sourceDate: sourceDate.toISOString() };
}

/**
 * Keeps each trip's "easy visa" flag (used by the trips filter) in line with the
 * data for Indian passports: easy when no country on the trip needs an embassy visa.
 */
export async function refreshEasyVisaFlags() {
  const trips = await prisma.trip.findMany({ select: { id: true, countryCodes: true, easyVisa: true } });
  const rules = new Map((await prisma.visaRule.findMany({ where: { passport: DEFAULT_PASSPORT } })).map((r) => [r.destination, r.category as VisaCategory]));
  for (const t of trips) {
    const codes = t.countryCodes.split(",").map((c) => c.trim()).filter(Boolean);
    if (!codes.length) continue;
    const easy = codes.every((c) => c === DEFAULT_PASSPORT || isEasy(rules.get(c) ?? "required"));
    if (easy !== t.easyVisa) await prisma.trip.update({ where: { id: t.id }, data: { easyVisa: easy } });
  }
  revalidateTag(VISA_TAG, { expire: 0 });
  revalidateTag(TRIPS_TAG, { expire: 0 });
}
