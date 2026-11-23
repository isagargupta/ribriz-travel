import type { Metadata } from "next";
import VisaChecker from "@/components/visa/VisaChecker";
import { getPublishedTrips } from "@/lib/trips";
import { DEFAULT_PASSPORT } from "@/lib/visa";
import { getPassports, getVisaRules, getVisaSync } from "@/lib/visa-data";

export const metadata: Metadata = {
  title: "Visa checker for Indian passports",
  description: "Do you need a visa? See visa-free, visa on arrival, e-visa and visa-required countries for Indian passport holders, and check any destination in seconds.",
};
export const revalidate = 86400;

export default async function VisaPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [{ to }, rules, passports, sync, trips] = await Promise.all([searchParams, getVisaRules(DEFAULT_PASSPORT), getPassports(), getVisaSync(), getPublishedTrips()]);
  const byCountry: Record<string, { slug: string; title: string }[]> = {};
  for (const t of trips) for (const c of t.countryCodes) (byCountry[c] ??= []).push({ slug: t.slug, title: t.title });
  const initialDest = to && /^[A-Za-z]{2}$/.test(to) ? to.toUpperCase() : undefined;

  return (
    <>
      <div className="wrap page-head">
        <span className="kicker">Visa checker</span>
        <h1>Do I need a visa?</h1>
        <p>Pick your passport and destination to see if you need a visa, can get one on arrival or online, or can go visa-free, and for how long.</p>
      </div>
      <section className="band" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <VisaChecker passports={passports} initial={{ passport: DEFAULT_PASSPORT, rules }} trips={byCountry} sourceDate={sync?.sourceDate ?? null} initialDest={initialDest} />
        </div>
      </section>
    </>
  );
}
