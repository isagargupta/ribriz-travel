import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskRiyaLink from "@/components/AskRiyaLink";
import ApplyCard from "@/components/visa-service/ApplyCard";
import { Flag, Icon, fmtDay } from "@/components/visa-service/ui";
import { fmt } from "@/lib/pricing";
import { visaDestination, visaDestinations } from "@/lib/visa-service";

export const revalidate = 3600;
type Props = { params: Promise<{ dest: string }> };

export async function generateStaticParams() {
  return (await visaDestinations()).filter((d) => d.curated).map((d) => ({ dest: d.destSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await visaDestination((await params).dest);
  if (!d) return { title: "Visa not found" };
  const p = d.products[0];
  return {
    title: `${d.country} visa for Indians: ${p.canApply ? "fees, documents and processing time" : "entry rules"}`,
    description: p.canApply
      ? `Apply for your ${d.country} ${p.kindLabel.toLowerCase()} online${d.from ? ` from ${fmt(d.from)}${d.fromIsServiceOnly ? " plus the government fee" : " all-in"}` : ""}. Ready in about ${d.fastest} working days, with an AI document check and expert filing.`
      : `${p.name} for Indian passport holders in ${d.country}: what to carry and what to fill in before you fly.`,
    alternates: { canonical: `/visa/${d.destSlug}` },
  };
}

const span = (n: number | null) => (n == null ? "Varies" : n >= 365 && n % 365 === 0 ? `${n / 365} year${n > 365 ? "s" : ""}` : `${n} days`);
const ICON: Record<string, "passport" | "user" | "doc" | "rupee" | "stay" | "shield"> = { passport: "passport", photo: "user", bank_statement: "rupee", itr: "doc", employment_proof: "doc", cover_letter: "doc", insurance: "shield", flight_booking: "doc", hotel_booking: "stay", other: "doc" };

export default async function VisaDestPage({ params }: Props) {
  const d = await visaDestination((await params).dest);
  if (!d) notFound();
  const main = d.products.find((p) => p.canApply) ?? d.products[0];
  const docs = [...new Map(d.products.flatMap((p) => p.docs).map((x) => [x.kind + x.label, x])).values()];
  const faq = [
    { q: `Do Indians need a visa for ${d.country}?`, a: main.canApply ? `Yes. Indian passport holders need a ${main.name.toLowerCase()}${main.stayDays ? ` (stays up to ${main.stayDays} days)` : ""}.` : `${main.name}. ${main.notes[0] ?? ""}` },
    ...(main.canApply ? [
      { q: `How much does the ${d.country} visa cost?`, a: main.feeOnRequest ? `Our service fee is ${fmt(main.serviceFee)} plus 18% GST per traveller. The government fee is confirmed by our visa team before you pay.` : `${fmt(main.perPerson)} per traveller with Ribriz: ${fmt(main.govtFee)} government fee, ${fmt(main.serviceFee)} service fee and 18% GST on the service fee.` },
      { q: `How long does it take?`, a: `About ${main.processingDays} working days after we file it${main.needsAppointment ? ", plus a visa-centre appointment" : ""}. Apply today and it should be ready by ${fmtDay(main.readyBy, true)}.` },
    ] : []),
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="vx-dhero">
        {d.image && <div className="vx-dhero-img" style={{ backgroundImage: `url(${d.image})` }} aria-hidden="true" />}
        <div className="wrap">
          <nav className="vx-crumbs" aria-label="Breadcrumb"><Link href="/visa">Visas</Link><span>/</span><span>{d.region}</span><span>/</span><span>{d.country}</span></nav>
          <div className="vx-dtitle vx-reveal">
            <Flag code={d.countryCode} size={72} />
            <div><h1>{d.country} visa</h1><p>For Indian passport holders · {main.kindLabel}</p></div>
          </div>
          <div className="vx-dchips vx-reveal d1">
            {main.canApply ? (
              <>
                <span className="vx-dchip"><Icon name="calendar" /> Ready by <b>{fmtDay(main.readyBy)}</b></span>
                <span className="vx-dchip"><Icon name="clock" /> <b>{main.processingDays}</b> working days</span>
                <span className="vx-dchip"><Icon name="rupee" /> From <b>{fmt(d.from)}{d.fromIsServiceOnly ? " + govt fee" : " all-in"}</b></span>
                {main.stayDays && <span className="vx-dchip"><Icon name="stay" /> Stay up to <b>{main.stayDays} days</b></span>}
              </>
            ) : <span className="vx-dchip"><Icon name="check" /> <b>No visa to apply for in advance</b></span>}
          </div>
        </div>
      </section>

      <div className="wrap vx-dlayout">
        <div className="vx-dmain">
          <section className="vx-panel vx-reveal d2">
            <h2>{d.products.length > 1 ? `${d.products.length} visa options` : "Visa details"}</h2>
            {d.products.map((p) => (
              <div key={p.slug} className="vx-prod">
                <div className="vx-prod-head"><h3>{p.name}</h3><span className={`vx-badge ${p.kind}`}>{p.kindLabel}</span>{!p.auto && !p.verified && <span className="vz-unverified">Fee being confirmed</span>}</div>
                <div className="vx-facts">
                  <div className="vx-fact"><small>Stay</small><strong>{span(p.stayDays)}</strong></div>
                  <div className="vx-fact"><small>Valid for</small><strong>{span(p.validityDays)}</strong></div>
                  <div className="vx-fact"><small>Entry</small><strong>{p.entries[0].toUpperCase() + p.entries.slice(1)}</strong></div>
                  <div className="vx-fact"><small>Processing</small><strong>{p.processingDays ? `${p.processingDays} working days` : "On arrival"}</strong></div>
                  <div className="vx-fact"><small>{p.feeOnRequest ? "Our fee" : "All-in fee"}</small><strong>{p.canApply ? `${fmt(p.perPerson)}${p.feeOnRequest ? " +" : ""}` : "Free"}</strong></div>
                </div>
                {p.notes.length > 0 && <ul className="vx-notes">{p.notes.map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            ))}
          </section>

          {docs.length > 0 && (
            <section className="vx-panel">
              <h2>What each traveller needs</h2>
              <ul className="vx-reqs">{docs.map((x) => <li key={x.kind + x.label}><span className="vx-ico"><Icon name={ICON[x.kind] ?? "doc"} /></span><span><b>{x.label}</b>{x.note && <small>{x.note}</small>}</span></li>)}</ul>
              <p style={{ margin: "14px 0 0", color: "var(--mute)", fontSize: 14 }}>Photos from your phone are fine. Our AI checks each one as you upload, and a visa expert reviews the full file.</p>
            </section>
          )}

          {main.canApply && (
            <section className="vx-panel">
              <h2>How it works</h2>
              <ol className="vx-flow-line">
                <li><span>1</span><div><b>Tell us your dates and who&apos;s travelling</b><small>About two minutes.</small></div></li>
                <li><span>2</span><div><b>Upload documents</b><small>Instant AI check tells you if anything needs fixing.</small></div></li>
                <li><span>3</span><div><b>Pay securely</b><small>{main.feeOnRequest ? "Once our team confirms the government fee." : "UPI, cards or net banking."}</small></div></li>
                <li><span>4</span><div><b>Expert check and filing</b><small>Within one working day{main.needsAppointment ? "; we book your visa-centre appointment" : ""}.</small></div></li>
                <li><span>5</span><div><b>Your visa arrives</b><small>By email and in your Ribriz app, tracked all the way.</small></div></li>
              </ol>
            </section>
          )}

          <section className="vx-panel">
            <h2>Questions</h2>
            <div className="vx-faq" style={{ maxWidth: "none" }}>{faq.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
            <p style={{ margin: "14px 0 0", color: "var(--mute)" }}>Something else? <AskRiyaLink q={`I have a question about the ${d.country} visa`}>Ask Riya</AskRiyaLink>.</p>
          </section>
        </div>
        <aside className="vx-side">
          {main.canApply ? <ApplyCard dest={d.destSlug} products={d.products} /> : (
            <div className="vx-card-apply">
              <h3>No visa needed in advance</h3>
              <p style={{ margin: 0, color: "var(--ink-2)" }}>{main.notes[0]}</p>
              <AskRiyaLink q={`Help me plan a trip to ${d.country}`}><span className="vx-btn primary block">Plan a {d.country} trip with Riya</span></AskRiyaLink>
            </div>
          )}
        </aside>
      </div>
      {main.canApply && <a href="#apply" className="vx-mbar"><span>From <b style={{ background: "none", padding: 0 }}>{fmt(d.from)}{d.fromIsServiceOnly ? "+" : ""}</b> · ready by {fmtDay(main.readyBy)}</span><b>Apply</b></a>}
    </>
  );
}
