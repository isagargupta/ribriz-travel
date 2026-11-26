import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import TripCard from "@/components/TripCard";
import AskRiyaLink from "@/components/AskRiyaLink";
import { MONTHS } from "@/lib/climate-rules";
import { COMPANY } from "@/lib/company";
import { climateFor, getDestination, getDestinations, visaForIndians } from "@/lib/destinations";
import { fmt } from "@/lib/pricing";

export const revalidate = 604800; // weekly; prices and trips refresh with the trip cache
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getDestinations()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDestination((await params).slug);
  if (!d) return { title: "Destination not found" };
  const c = await climateFor(d.name, d.countryCodes[0] ?? null);
  return {
    title: `${d.name} trip from India: best time to visit, visa and cost`,
    description: `${c?.best ? `Best time to visit ${d.name}: ${c.best}. ` : ""}${d.trips.length} ${d.name} package${d.trips.length > 1 ? "s" : ""} from ${fmt(d.fromPrice)} per person with flights from India. Visa rules for Indian passports.`,
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: { images: [d.image] },
  };
}

const VERDICT = { best: "Best", good: "Good", ok: "OK", avoid: "Avoid" } as const;

export default async function DestinationPage({ params }: Props) {
  const d = await getDestination((await params).slug);
  if (!d) notFound();
  const [c, visas] = await Promise.all([climateFor(d.name, d.countryCodes[0] ?? null), visaForIndians(d.countryCodes)]);
  const maxRain = Math.max(1, ...(c?.months.map((m) => m.rainMm) ?? [1]));
  const site = (process.env.NEXT_PUBLIC_SITE_URL || COMPANY.website).replace(/\/$/, "");
  const visaLine = visas.length ? visas.map((v) => `${v.country}: ${v.label}`).join("; ") : "No visa needed: it's in India. Carry a government photo ID.";

  const faq = [
    c?.best && { q: `When is the best time to visit ${d.name}?`, a: `${c.best[0].toUpperCase() + c.best.slice(1)}, based on ten years of weather records${c.avoid ? `. ${c.avoid[0].toUpperCase() + c.avoid.slice(1)} is the least comfortable time (heat or heavy rain)` : ""}.` },
    { q: `Do Indians need a visa for ${d.name}?`, a: visaLine + (visas.some((v) => v.processing > 0) ? ". Ribriz can help you apply." : "") },
    { q: `How much does a ${d.name} trip cost from India?`, a: `Our ${d.name} packages start from ${fmt(d.fromPrice)} per person for ${d.nights[0] === d.nights[1] ? d.nights[0] : `${d.nights[0]}–${d.nights[1]}`} nights${d.trips.some((t) => t.flight) ? ", including return flights from Mumbai" : ""}, before 5% GST.` },
  ].filter((x): x is { q: string; a: string } => !!x);

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Destinations", item: `${site}/destinations` }, { "@type": "ListItem", position: 2, name: d.name, item: `${site}/destinations/${d.slug}` }] },
  ];

  return (
    <div className="dest">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="dest-hero">
        <Image src={d.image} alt={d.name} fill priority sizes="100vw" />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/destinations">Destinations</Link> / {d.name}</nav>
          <h1>{d.name} from India</h1>
          <p>{c?.best ? <>Best time to go: <b>{c.best}</b> · </> : null}{d.trips.length} trip{d.trips.length > 1 ? "s" : ""} from <b>{fmt(d.fromPrice)}</b> per person</p>
        </div>
      </div>

      <div className="wrap dest-body">
        {c && (
          <section className="panel">
            <h2>When to go to {d.name}</h2>
            <p className="muted">From ten years of daily weather records. Bars show rain; the number is the average daytime high.</p>
            <div className="clim" role="table" aria-label={`Average weather in ${d.name} by month`}>
              {c.months.map((m) => (
                <div key={m.month} className={`clim-m v-${m.verdict}`} role="row" title={`${MONTHS[m.month - 1]}: ${m.high}°/${m.low}°C, ${m.rainMm} mm rain`}>
                  <span className="clim-t" role="cell">{m.high}°</span>
                  <span className="clim-bar" aria-hidden="true"><i style={{ height: `${Math.max(3, (m.rainMm / maxRain) * 100)}%` }} /></span>
                  <span className="clim-n" role="cell">{MONTHS[m.month - 1]}</span>
                  <small role="cell">{VERDICT[m.verdict]}</small>
                </div>
              ))}
            </div>
            <p style={{ marginBottom: 0 }}>{c.best && <>The most comfortable months are <b>{c.best}</b>. </>}{c.avoid && <>Think twice about <b>{c.avoid}</b>, when it's very hot or very wet. </>}Prices are often lower just outside the best months.</p>
          </section>
        )}

        <section className="panel">
          <h2>Visa for Indian passport holders</h2>
          {visas.length === 0 ? <p>No visa needed: it&apos;s in India. Carry a government photo ID (Aadhaar, passport or driving licence).</p> : (
            <ul className="dest-visa">{visas.map((v) => <li key={v.code}><b>{v.country}: {v.label}</b>{v.days ? ` · up to ${v.days} days` : ""}<p className="muted">{v.blurb}</p></li>)}</ul>
          )}
          <p className="fine">From a public dataset that can lag official changes: confirm on the official government site before you travel. <Link href="/visa">Check other passports</Link>.</p>
        </section>

        <section>
          <h2>Our {d.name} trips</h2>
          <div className="grid">{d.trips.map((t, i) => <TripCard key={t.id} t={t} priority={i < 2} />)}</div>
          <p className="muted" style={{ marginTop: 14 }}>Want something different in {d.name}? <AskRiyaLink q={`Plan a custom ${d.name} trip for me`}>Ask Riya</AskRiyaLink> and our trip designers will build it.</p>
        </section>

        <section className="panel">
          <h2>{d.name}: quick answers</h2>
          <dl className="dest-faq">{faq.map((f) => <div key={f.q}><dt>{f.q}</dt><dd>{f.a}</dd></div>)}</dl>
        </section>
      </div>
    </div>
  );
}
