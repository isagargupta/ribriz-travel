import type { Metadata } from "next";
import AskRiyaLink from "@/components/AskRiyaLink";
import VisaChecker from "@/components/visa/VisaChecker";
import VisaCatalog from "@/components/visa-service/VisaCatalog";
import VisaSearch from "@/components/visa-service/VisaSearch";
import { Icon } from "@/components/visa-service/ui";
import { getPublishedTrips } from "@/lib/trips";
import { DEFAULT_PASSPORT } from "@/lib/visa";
import { getPassports, getVisaRules, getVisaSync } from "@/lib/visa-data";
import { toCard, visaDestinations } from "@/lib/visa-service";

export const metadata: Metadata = {
  title: "Visas for Indian passport holders: apply online for 190+ countries",
  description: "Apply for your visa online with Ribriz: the exact fee and the date your visa should be ready, an instant AI document check and a visa expert who files it. Dubai, Schengen, UK, USA, Singapore, Japan and 190+ countries.",
};
export const revalidate = 3600;

const TRUST = [
  { i: "calendar" as const, t: "Date before you pay", d: "See when your visa should be ready, for your exact dates." },
  { i: "scan" as const, t: "AI document check", d: "Passport and photo checked in seconds as you upload." },
  { i: "shield" as const, t: "Expert-filed", d: "A visa specialist reviews every file before it's submitted." },
  { i: "track" as const, t: "Live tracking", d: "Every step on your phone, with updates as they happen." },
];
const STEPS = [
  { t: "Choose your visa", d: "Search your destination. We show the exact visa you need, the full price and when it should be ready." },
  { t: "Upload once", d: "Add each traveller's passport and photo from your phone. Our AI checks them instantly and tells you if anything needs fixing." },
  { t: "We file. You track.", d: "A visa expert reviews and submits your application. Follow it live and get your visa by email and in the app." },
];
const FAQ = [
  { q: "How long will my visa take?", a: "Every visa shows the date it should be ready if you apply today: one working day for our expert check and filing, plus the destination's usual processing time. Embassy visas may also need a visa-centre appointment, which we book." },
  { q: "What exactly do I pay?", a: "The government or embassy fee (which we pay on your behalf), our service fee and 18% GST on our service fee. Where a government fee isn't fixed, our visa team confirms it before you pay, and you pay nothing until then." },
  { q: "Can I apply for my whole family together?", a: "Yes. Add everyone to one application, upload each person's documents and pay once. Prices are per traveller." },
  { q: "What if a document isn't right?", a: "Our AI flags common problems the moment you upload (blurry scans, wrong photo background, passports expiring too soon), and a visa expert checks the whole file before it's filed. If anything is missing we tell you exactly what to send." },
  { q: "Is my passport data safe?", a: "Your documents are stored privately and opened only through short-lived links by you and our visa team. They're deleted automatically after your trip." },
  { q: "I don't have an Indian passport.", a: "Our online service is for Indian passport holders today. Use the visa checker below to see what your passport needs, and ask Riya: our team can often still help." },
];

/** The visa service home: search, trust, every destination by region, how it works, rules checker and FAQ. */
export default async function VisaPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [{ to }, dests, rules, passports, sync, trips] = await Promise.all([searchParams, visaDestinations(), getVisaRules(DEFAULT_PASSPORT), getPassports(), getVisaSync(), getPublishedTrips()]);
  const cards = dests.map(toCard);
  const quick = ["dubai", "singapore", "thailand", "france", "united-kingdom", "japan"].map((s) => cards.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => !!c);
  const byCountry: Record<string, { slug: string; title: string }[]> = {};
  for (const t of trips) for (const c of t.countryCodes) (byCountry[c] ??= []).push({ slug: t.slug, title: t.title });
  const initialDest = to && /^[A-Za-z]{2}$/.test(to) ? to.toUpperCase() : undefined;
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="vx-hero">
        <div className="vx-grid-bg" aria-hidden="true" />
        <div className="wrap">
          <span className="vx-eyebrow vx-reveal"><Icon name="sparkle" size={16} /> Visas for Indian passport holders · {cards.length} destinations</span>
          <h1 className="vx-reveal d1">Your visa, sorted.<br /><em>Know the date before you pay.</em></h1>
          <p className="vx-lead vx-reveal d1">The exact visa, the full price and the day it should be ready. Upload once, an expert files it, and you track every step.</p>
          <VisaSearch dests={cards} quick={quick} />
        </div>
      </section>

      <div className="wrap vx-trust">
        <div className="vx-trust-in">{TRUST.map((x) => <div key={x.t}><span className="vx-ico"><Icon name={x.i} /></span><span><b>{x.t}</b><small>{x.d}</small></span></div>)}</div>
      </div>

      <section className="vx-sec">
        <div className="wrap">
          <div className="vx-sec-head"><div><h2>Where are you going?</h2><p>Live fees and ready-by dates. Prices are per traveller.</p></div><a href="#all-countries" className="vx-btn ghost">Browse A–Z</a></div>
          <VisaCatalog dests={cards} />
        </div>
      </section>

      <section className="vx-sec tint">
        <div className="wrap">
          <div className="vx-sec-head"><div><h2>Three steps. No embassy queues.</h2><p>Most applications take under five minutes.</p></div></div>
          <div className="vx-steps">{STEPS.map((s, i) => <div key={s.t} className="vx-step"><span className="vx-step-n">{i + 1}</span><b>{s.t}</b><p>{s.d}</p></div>)}</div>
        </div>
      </section>

      <section className="vx-sec" id="rules">
        <div className="wrap">
          <div className="vx-sec-head"><div><h2>Visa rules for any passport</h2><p>Not on an Indian passport, or just checking? See what any passport needs, anywhere.</p></div></div>
          <VisaChecker passports={passports} initial={{ passport: DEFAULT_PASSPORT, rules }} trips={byCountry} sourceDate={sync?.sourceDate ?? null} initialDest={initialDest} />
        </div>
      </section>

      <section className="vx-sec tint">
        <div className="wrap">
          <div className="vx-sec-head" style={{ justifyContent: "center", textAlign: "center" }}><div><h2>Questions, answered</h2></div></div>
          <div className="vx-faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
          <p style={{ textAlign: "center", color: "var(--mute)", marginTop: 20 }}>Still unsure? <AskRiyaLink q="I have a question about getting a visa">Ask Riya</AskRiyaLink>, any time.</p>
        </div>
      </section>
    </>
  );
}
