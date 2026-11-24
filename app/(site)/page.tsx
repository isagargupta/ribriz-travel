import Link from "next/link";
import Hero from "@/components/home/Hero";
import SearchConsole from "@/components/home/SearchConsole";
import { Bento, Deals, Newsletter, PriceCalendar, RecentlyViewed, Ticker } from "@/components/home/HomeSections";
import Reveal from "@/components/ui/Reveal";
import AskRiyaBand from "@/components/assistant/AskRiyaBand";
import ForYou from "@/components/home/ForYou";
import { getCalendar, getPublishedTrips } from "@/lib/trips";
import { THEMES } from "@/lib/pricing";
import { getFxRates } from "@/lib/fx";
import { prisma } from "@/lib/db";
import Stars from "@/components/Stars";

export const revalidate = 3600;

export default async function Home() {
  const [trips, calendar, fx, stories] = await Promise.all([
    getPublishedTrips(), getCalendar(14), getFxRates(),
    // only real, published reviews from travellers who took a trip with us
    prisma.review.findMany({ where: { status: "published", stars: { gte: 4 } }, orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const rate = (c: string) => (fx?.perInr[c] ? Math.round(1 / fx.perInr[c]) : null);
  const featured = [...trips.filter((t) => t.featured), ...trips.filter((t) => !t.featured)].slice(0, 5);
  const destinations = [...new Set(trips.flatMap((t) => [t.dest, t.country.split(" · ")[0]]))];

  return (
    <>
      <Hero />
      <SearchConsole destinations={destinations} />
      <Ticker trips={trips} />
      <ForYou trips={trips} />
      <RecentlyViewed trips={trips} />

      <section className="band" style={{ paddingBottom: 0 }}>
        <div className="wrap"><Reveal><AskRiyaBand /></Reveal></div>
      </section>

      <section className="band">
        <div className="wrap">
          <Reveal><div className="sec-head">
            <div><span className="kicker">Trending this month</span><h2>Where everyone&apos;s going</h2></div>
            <p>Our most-booked trips right now. Tap one to see every date and its price.</p>
          </div></Reveal>
          <Reveal delay={80}><Bento trips={featured} /></Reveal>
        </div>
      </section>

      <section className="band" id="deals" style={{ paddingTop: 0 }}>
        <div className="wrap"><Reveal><Deals trips={trips} /></Reveal></div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><div className="sec-head"><div><span className="kicker">Travel styles</span><h2>How do you like to travel?</h2></div><p>Pick a style to see matching trips.</p></div></Reveal>
          <div className="themes">
            {THEMES.map((th, i) => (
              <Reveal key={th.key} delay={i * 50}>
                <Link className="theme-tile" style={{ background: th.bg }} href={`/trips?theme=${th.key}`}>
                  <span className="n">{trips.filter((t) => t.themes.includes(th.key)).length} trips</span>
                  <span className="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0b1240" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={th.icon} /></svg></span>
                  <b>{th.label}</b><span>{th.blurb}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap"><Reveal><PriceCalendar days={calendar} /></Reveal></div>
      </section>

      <section className="band how" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><div className="sec-head"><div><span className="kicker">How booking works</span><h2>Clear from the first click</h2></div></div></Reveal>
          <div className="steps3">
            {[
              ["See the real total", "Every price shows what it covers. Switch to “Total” at the top to see the full amount for your group, taxes included."],
              ["Reserve free for 48 hours", "Pick a date and hold that exact price. No card, no payment, no pressure."],
              ["An expert confirms, then you book", "We confirm flights and rooms by email within 2 working hours. Pay 10% to book and the rest 30 days before you go."],
            ].map(([h, p], i) => (
              <Reveal key={h} delay={i * 90}><div className="step3"><span className="num">{i + 1}</span><h3>{h}</h3><p>{p}</p></div></Reveal>
            ))}
          </div>
        </div>
      </section>

      {stories.length > 0 && (
        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal><div className="sec-head"><div><span className="kicker">Traveller reviews</span><h2>Back home and still smiling</h2></div><p>From travellers who took these trips with Ribriz, published as written.</p></div></Reveal>
            <div className="stories">
              {stories.map((r, i) => {
                const t = trips.find((x) => x.id === r.tripId);
                return (
                  <Reveal key={r.id} delay={i * 90}>
                    <figure className="story" style={{ background: ["#ffd6c9", "#cfe9ff", "#d4f5e7"][i % 3] }}>
                      <Stars value={r.stars} />
                      <blockquote>{r.body.length > 220 ? r.body.slice(0, 217) + "…" : r.body}</blockquote>
                      <figcaption className="who"><span className="av" style={{ background: ["#ff5a36", "#0b4fc4", "#0fb68f"][i % 3] }}>{r.displayName[0]}</span><div>{r.displayName}<span>{t ? `${t.dest} · ` : ""}{r.travelledOn ?? ""} · ✓ verified trip</span></div></figcaption>
                    </figure>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="band" id="services" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="stats">
            <div className="stat"><b>{trips.length}</b><span>handpicked trips</span></div>
            <div className="stat"><b>{new Set(trips.map((t) => t.country)).size}</b><span>destinations</span></div>
            <div className="stat"><b>{trips.reduce((n, t) => n + t.depDates.length, 0)}</b><span>open departure dates</span></div>
            <div className="stat"><b>48 h</b><span>free price hold</span></div>
          </div>
          <Reveal><div className="sec-head"><div><span className="kicker">Before you fly</span><h2>Everything around the trip</h2></div><p>Sorted in the same booking, by the same team.</p></div></Reveal>
          <div className="services">
            <div className="svc"><span className="ico" style={{ background: "#ffe7a1" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></svg></span><h3>Forex</h3><p>Riya shows today&apos;s market rate for your currency; our forex partner confirms the final rate and delivery.</p><span className="rate">{rate("USD") ? `Today: 1 USD ≈ ₹${rate("USD")} · 1 EUR ≈ ₹${rate("EUR")}` : "Live market rates"}</span></div>
            <div className="svc"><span className="ico" style={{ background: "#cfe9ff" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M8 17h8" /></svg></span><h3>Visa help</h3><p>See what your passport needs, upload documents for an instant check, and we file e-Visas and embassy visas for you.</p><span className="rate">Instant check for your passport</span></div>
            <div className="svc"><span className="ico" style={{ background: "#d4f5e7" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg></span><h3>Travel insurance</h3><p>Tell Riya your trip; our team sends plan options sized to your dates and travellers.</p><span className="rate">Quotes from our team</span></div>
            <div className="svc"><span className="ico" style={{ background: "#ffd6c9" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21l3-9 9-9 6 6-9 9z" /><path d="M14 4l6 6" /></svg></span><h3>Custom trip</h3><p>Tell an expert your dates and budget. Get a costed plan within one working day.</p><Link className="btn hot sm" href="/plan" style={{ justifySelf: "start" }}>Plan my trip</Link></div>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap"><Reveal><Newsletter /></Reveal></div>
      </section>
    </>
  );
}
