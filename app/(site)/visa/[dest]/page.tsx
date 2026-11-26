import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskRiyaLink from "@/components/AskRiyaLink";
import ApplyCard from "@/components/visa-service/ApplyCard";
import { fmt } from "@/lib/pricing";
import { visaDestination, visaDestinations } from "@/lib/visa-service";

export const revalidate = 3600;
type Props = { params: Promise<{ dest: string }> };

export async function generateStaticParams() {
  return (await visaDestinations()).map((d) => ({ dest: d.destSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await visaDestination((await params).dest);
  if (!d) return { title: "Visa not found" };
  const p = d.products[0];
  return {
    title: `${d.country} visa for Indians: fee, documents and processing time`,
    description: `Apply for your ${d.country} ${p.kindLabel.toLowerCase()} online${d.from ? ` from ${fmt(d.from)} all-in` : ""}. Ready in about ${d.fastest} working days, AI document check and expert filing.`,
    alternates: { canonical: `/visa/${d.destSlug}` },
  };
}

const days = (n: number | null) => (n == null ? "–" : n >= 365 && n % 365 === 0 ? `${n / 365} year${n > 365 ? "s" : ""}` : `${n} days`);

export default async function VisaDestPage({ params }: Props) {
  const d = await visaDestination((await params).dest);
  if (!d) notFound();
  const main = d.products.find((p) => p.canApply) ?? d.products[0];
  const allDocs = [...new Map(d.products.flatMap((p) => p.docs).map((x) => [x.kind + x.label, x])).values()];
  const faq = [
    { q: `Do Indians need a visa for ${d.country}?`, a: `${main.kindLabel === "Visa-free" ? `No visa is needed for short stays${main.stayDays ? ` (up to ${main.stayDays} days)` : ""}, but ${main.notes[0] ?? "check the entry requirements"}` : `Yes: Indian passport holders need a ${main.name.toLowerCase()}`}.` },
    ...(main.canApply ? [{ q: `How much does a ${d.country} visa cost?`, a: `${fmt(main.perPerson)} per traveller with Ribriz: ${fmt(main.govtFee)} government fee, ${fmt(main.serviceFee)} service fee and 18% GST on the service fee.` }] : []),
    { q: `How long does the ${d.country} visa take?`, a: `About ${main.processingDays} working days after we file it${main.needsAppointment ? ", plus a visa-centre appointment" : ""}. Apply today and it should be ready by ${new Date(main.readyBy + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}.` },
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  return (
    <div className="vz-dest">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="vz-dhero" style={d.image ? { backgroundImage: `linear-gradient(180deg, rgba(11,18,64,.35), rgba(11,18,64,.85)), url(${d.image})` } : undefined}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/visa">Visas</Link> / {d.country}</nav>
          <h1><span aria-hidden="true">{d.flag}</span> {d.country} visa for Indians</h1>
          <p>{main.canApply ? <>From <b>{fmt(d.from)}</b> all-in · ready in about <b>{d.fastest} working days</b></> : <>{main.name}</>}</p>
        </div>
      </section>

      <div className="wrap vz-layout">
        <div className="vz-main">
          {d.products.map((p) => (
            <section key={p.slug} className="panel vz-prod">
              <div className="vz-prod-head"><h2>{p.name}</h2><span className="vz-kind">{p.kindLabel}</span>{!p.verified && <span className="vz-unverified" title="Our team is confirming this fee with the official source">Fee being confirmed</span>}</div>
              <dl className="vz-keyfacts">
                <div><dt>Stay</dt><dd>{days(p.stayDays)}</dd></div>
                <div><dt>Valid for</dt><dd>{days(p.validityDays)}</dd></div>
                <div><dt>Entry</dt><dd>{p.entries[0].toUpperCase() + p.entries.slice(1)}</dd></div>
                <div><dt>Processing</dt><dd>{p.processingDays ? `${p.processingDays} working days` : "On arrival"}</dd></div>
                <div><dt>All-in fee</dt><dd>{p.canApply ? fmt(p.perPerson) : "Free"}</dd></div>
              </dl>
              {p.notes.length > 0 && <ul className="vz-notes">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </section>
          ))}

          {allDocs.length > 0 && (
            <section className="panel">
              <h2>Documents each traveller needs</h2>
              <ul className="vz-docs">{allDocs.map((x) => <li key={x.kind + x.label}><b>{x.label}</b>{x.note && <small>{x.note}</small>}</li>)}</ul>
              <p className="muted" style={{ marginBottom: 0, fontSize: 14 }}>Upload photos or PDFs from your phone. Our AI checks each one in seconds and a visa expert reviews the full file before filing.</p>
            </section>
          )}

          <section className="panel">
            <h2>How it works</h2>
            <ol className="vz-timeline">
              <li><b>Apply in 3 minutes</b><span>Travel date, travellers, contact details.</span></li>
              <li><b>Upload documents</b><span>Instant AI check tells you if anything needs fixing.</span></li>
              <li><b>Pay securely</b><span>UPI, cards or net banking. GST invoice for the service fee.</span></li>
              <li><b>Expert check and filing</b><span>Within one working day{main.needsAppointment ? "; we book your visa-centre appointment" : ""}.</span></li>
              <li><b>Get your visa</b><span>By email and in your app, with live tracking all the way.</span></li>
            </ol>
          </section>

          <section className="panel">
            <h2>Questions about the {d.country} visa</h2>
            <div className="vz-faq">{faq.map((f) => <details key={f.q} open><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
            <p className="muted" style={{ marginBottom: 0 }}>More questions? <AskRiyaLink q={`I have a question about the ${d.country} visa`}>Ask Riya</AskRiyaLink>.</p>
          </section>
        </div>
        <aside className="vz-side"><ApplyCard dest={d.destSlug} products={d.products} /></aside>
      </div>
      {main.canApply && <a href="#apply" className="vz-mbar"><span>From <b>{fmt(d.from)}</b> · ready ~{d.fastest} working days</span><b>Apply →</b></a>}
    </div>
  );
}
