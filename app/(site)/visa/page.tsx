import type { Metadata } from "next";
import VisaChecker from "@/components/visa/VisaChecker";
import VisaFinder from "@/components/visa-service/VisaFinder";
import AskRiyaLink from "@/components/AskRiyaLink";
import { getPublishedTrips } from "@/lib/trips";
import { DEFAULT_PASSPORT, VISA_META, countryName } from "@/lib/visa";
import { getPassports, getVisaRules, getVisaSync } from "@/lib/visa-data";
import { visaDestinations } from "@/lib/visa-service";

export const metadata: Metadata = {
  title: "Apply for your visa online: e-Visa, Schengen, UK, Dubai and more",
  description: "Visas for Indian passport holders, handled by experts: clear fees, the date your visa should be ready, instant AI document checks and live tracking. Dubai, Singapore, Japan, Schengen, UK, Vietnam and more.",
};
export const revalidate = 3600;

const STEPS = [
  { n: "1", t: "Pick your visa", d: "Search your destination and see the exact visa, the full fee and the date it should be ready, before you pay." },
  { n: "2", t: "Upload once", d: "Snap each traveller's passport and photo. Our AI checks them in seconds and tells you if anything needs fixing." },
  { n: "3", t: "We file, you track", d: "A visa expert checks everything and files it. Follow every step in the app and get your visa by email." },
];
const WHY = [
  { i: "⚡", t: "Instant document check", d: "Blurry passport, wrong photo background, expiring passport: caught the moment you upload, not days later." },
  { i: "🧾", t: "One clear price", d: "Government fee plus our service fee and GST, shown upfront per traveller. No surprises at checkout." },
  { i: "📍", t: "Live tracking", d: "Documents, payment, expert check, filed, issued: see where it is any time, with updates on your phone." },
  { i: "🧳", t: "Part of your trip", d: "Your visa sits next to your flights, hotels and insurance in one app, with Riya on hand 24×7." },
];
const FAQ = [
  { q: "How long does it take?", a: "Each visa shows the date it should be ready if you apply today: one working day for our check and filing, plus the destination's usual processing time. Embassy visas also need a visa-centre appointment." },
  { q: "What do I pay?", a: "The government (or embassy) fee, which we pay on your behalf, plus our service fee with 18% GST. The total per traveller is shown before you apply." },
  { q: "Can I apply for my whole family?", a: "Yes. Add everyone in one application and upload each person's documents; the price is per traveller." },
  { q: "What if something's wrong with a document?", a: "Our AI check flags common problems straight away, and a visa expert reviews every file before it's filed. If anything is missing we tell you exactly what to upload." },
  { q: "Is my passport data safe?", a: "Documents are stored privately, opened only through short-lived links by you and our visa team, and deleted after your trip." },
];

/** The visa service: search, popular visas with prices and ready-by dates, how it works, and the rules checker for any passport. */
export default async function VisaPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [{ to }, dests, rules, passports, sync, trips] = await Promise.all([searchParams, visaDestinations(), getVisaRules(DEFAULT_PASSPORT), getPassports(), getVisaSync(), getPublishedTrips()]);
  const covered = new Set(dests.map((d) => d.countryCode));
  const others = rules.filter((r) => !covered.has(r.d)).map((r) => ({ code: r.d, name: countryName(r.d), rule: VISA_META[r.c].label }));
  const byCountry: Record<string, { slug: string; title: string }[]> = {};
  for (const t of trips) for (const c of t.countryCodes) (byCountry[c] ??= []).push({ slug: t.slug, title: t.title });
  const initialDest = to && /^[A-Za-z]{2}$/.test(to) ? to.toUpperCase() : undefined;

  return (
    <>
      <section className="vz-hero">
        <div className="wrap">
          <span className="kicker" style={{ color: "#ffc531" }}>Visas for Indian passport holders</span>
          <h1>Your visa, handled.<br /><span>Know the date before you pay.</span></h1>
          <p>Clear fees, an instant AI document check and a visa expert who files it for you. Track every step in the app.</p>
          <VisaFinder dests={dests} others={others} />
          <ul className="vz-trust"><li>✓ Price and ready-by date upfront</li><li>✓ AI document check in seconds</li><li>✓ Expert review before filing</li><li>✓ Live tracking</li></ul>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2 className="center">Your visa in three steps</h2>
          <ol className="vz-steps">{STEPS.map((s) => <li key={s.n}><span>{s.n}</span><b>{s.t}</b><p>{s.d}</p></li>)}</ol>
        </div>
      </section>

      <section className="band alt">
        <div className="wrap">
          <h2 className="center">Why apply with Ribriz</h2>
          <div className="vz-why">{WHY.map((w) => <div key={w.t}><span aria-hidden="true">{w.i}</span><b>{w.t}</b><p>{w.d}</p></div>)}</div>
        </div>
      </section>

      <section className="band" id="rules">
        <div className="wrap">
          <h2>Visa rules for any passport</h2>
          <p className="muted" style={{ marginTop: -6 }}>Not travelling on an Indian passport, or just checking? See what any passport needs for any country.</p>
          <VisaChecker passports={passports} initial={{ passport: DEFAULT_PASSPORT, rules }} trips={byCountry} sourceDate={sync?.sourceDate ?? null} initialDest={initialDest} />
        </div>
      </section>

      <section className="band alt">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 className="center">Questions</h2>
          <div className="vz-faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
          <p className="center muted" style={{ marginTop: 16 }}>Something else? <AskRiyaLink q="I have a question about getting a visa">Ask Riya</AskRiyaLink>; she&apos;ll bring in a visa expert.</p>
        </div>
      </section>
    </>
  );
}
