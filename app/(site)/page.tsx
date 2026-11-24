import Link from "next/link";
import Hero from "@/components/home/Hero";
import SearchConsole from "@/components/home/SearchConsole";
import { Bento, Deals, Newsletter, PriceCalendar, RecentlyViewed, Ticker } from "@/components/home/HomeSections";
import Reveal from "@/components/ui/Reveal";
import AskRiyaBand from "@/components/assistant/AskRiyaBand";
import ForYou from "@/components/home/ForYou";
import { getCalendar, getPublishedTrips } from "@/lib/trips";
import { THEMES, RATES } from "@/lib/pricing";

export const revalidate = 3600;

export default async function Home() {
  const [trips, calendar] = await Promise.all([getPublishedTrips(), getCalendar(14)]);
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
              ["An expert confirms, then you book", "We confirm flights and rooms by email within 2 working hours. Pay 10% to book and the rest 30 days before you go, or in 0% EMIs."],
            ].map(([h, p], i) => (
              <Reveal key={h} delay={i * 90}><div className="step3"><span className="num">{i + 1}</span><h3>{h}</h3><p>{p}</p></div></Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><div className="sec-head"><div><span className="kicker">Traveller stories</span><h2>Back home and still smiling</h2></div></div></Reveal>
          <div className="stories">
            {[
              ["#ffd6c9", "#ff5a36", "PA", "Transfers on time every day, and the cheapest-week calendar saved us ₹18,000 on Bali.", "Priya & Arjun", "Pune · Bali, 7 nights"],
              ["#cfe9ff", "#0b4fc4", "MF", "Our tour manager knew every shortcut in Rome. The kids still talk about the gondola.", "The Mehta family", "Surat · Europe, 10 nights"],
              ["#d4f5e7", "#0fb68f", "K", "Price on the site matched the price at check-in. No surprises, just a very good week in Crete.", "Kasia", "Wrocław · Crete, 8 nights"],
            ].map(([bg, av, ini, q, who, sub], i) => (
              <Reveal key={who} delay={i * 90}>
                <figure className="story" style={{ background: bg }}>
                  <blockquote>{q}</blockquote>
                  <figcaption className="who"><span className="av" style={{ background: av }}>{ini}</span><div>{who}<span>{sub}</span></div></figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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
            <div className="svc"><span className="ico" style={{ background: "#ffe7a1" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></svg></span><h3>Forex card</h3><p>Load USD, EUR, THB and 12 more. Delivered home in 24 hours.</p><span className="rate">1 EUR ≈ ₹{(1 / RATES.EUR).toFixed(0)} · 1 PLN ≈ ₹{(1 / RATES.PLN).toFixed(0)}</span></div>
            <div className="svc"><span className="ico" style={{ background: "#cfe9ff" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M8 17h8" /></svg></span><h3>Visa help</h3><p>Checklist, appointment booking and form filling for 60+ countries.</p><span className="rate">Schengen · UK · USA · Japan</span></div>
            <div className="svc"><span className="ico" style={{ background: "#d4f5e7" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg></span><h3>Travel cover</h3><p>Medical up to $100,000, lost baggage and trip cancellation in one policy.</p><span className="rate">from ₹38 / day</span></div>
            <div className="svc"><span className="ico" style={{ background: "#ffd6c9" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21l3-9 9-9 6 6-9 9z" /><path d="M14 4l6 6" /></svg></span><h3>Custom trip</h3><p>Tell an expert your dates and budget. Get a costed plan within a day.</p><Link className="btn hot sm" href="/plan" style={{ justifySelf: "start" }}>Plan my trip</Link></div>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap"><Reveal><Newsletter /></Reveal></div>
      </section>
    </>
  );
}
