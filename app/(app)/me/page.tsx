import type { Metadata } from "next";
import Link from "next/link";
import AskButton from "@/components/me/AskButton";
import CommandBar from "@/components/me/CommandBar";
import CountUp from "@/components/me/CountUp";
import LiveFeed from "@/components/me/LiveFeed";
import NeedsYou from "@/components/me/NeedsYou";
import RiyaOrb from "@/components/me/RiyaOrb";
import TripCardX from "@/components/me/TripCardX";
import TypedStatus from "@/components/me/TypedStatus";
import LiveTrip from "@/components/me/LiveTrip";
import PhoneSetup from "@/components/me/PhoneSetup";
import { myDashboard } from "@/lib/dashboard";
import { liveTrips } from "@/lib/live";
import { fmt, fmtDate } from "@/lib/pricing";

export const metadata: Metadata = { title: "Travel HQ", robots: { index: false } };

const WORKING: Record<string, string> = { in_progress: "is sorting", waiting: "is chasing our team about" };
const TASK_PHRASE: Record<string, string> = { choose_trip: "the best trip and date", price_hold: "your price hold", visa: "your visa", insurance: "travel insurance", forex: "your forex", flights: "your flights", hotels: "your hotels", prep: "your pre-trip checklist" };

export default async function Overview() {
  const { d, owner } = (await myDashboard())!; // the layout already sent signed-out visitors to sign in
  const live = await liveTrips(owner);
  // while travelling, today's plan is the first thing on the screen
  const away = live.filter((t) => t.phase !== "leaving_soon");
  const soon = live.filter((t) => t.phase === "leaving_soon");
  const first = d.name?.split(" ")[0];
  const working = d.trips.flatMap((t) => t.tasks.filter((x) => WORKING[x.status]).map((x) => `${WORKING[x.status]} ${TASK_PHRASE[x.kind] ?? x.title.toLowerCase()} for ${t.dest ?? t.title}`));
  const mood = d.approvals.length ? "attention" : working.length ? "working" : "idle";
  const next = d.trips.filter((t) => t.daysToGo !== null && t.daysToGo >= 0).sort((a, b) => a.daysToGo! - b.daysToGo!)[0];

  return (
    <div className="me">
      {away.length > 0 && <div className="wrap me-away">{away.map((t, i) => <LiveTrip key={t.missionId} t={t} compact={i > 0} />)}</div>}
      <section className="me-hero">
        <div className="me-aurora" aria-hidden="true" />
        <div className="wrap me-hero-in">
          <div className="me-hello">
            <div className="me-kicker"><span>Your travel HQ</span><span className="live-dot" title="Updates as Riya works"><i /> Live</span></div>
            <h1>{first ? <>Hi {first} <span className="wave" aria-hidden="true">👋</span></> : "Welcome back"}</h1>
            <TypedStatus lines={d.status.map((s) => s[0].toUpperCase() + s.slice(1) + ".")} />
            <CommandBar />
          </div>
          <div className="me-orb"><RiyaOrb mood={mood} /></div>
        </div>
        <div className="wrap">
          <div className="me-stats">
            <Link href="/me/trips"><b><CountUp to={d.trips.length} /></b><span>trip{d.trips.length === 1 ? "" : "s"} in motion</span></Link>
            <Link href={next ? `/me/trips/${next.id}` : "/me/trips"}><b>{next ? <CountUp to={next.daysToGo!} /> : "–"}</b><span>{next ? `days to ${next.dest}` : "next trip: not booked yet"}</span></Link>
            <Link href="/me/bookings"><b><CountUp to={d.bookings.filter((b) => b.status === "booked").length} /></b><span>bookings confirmed</span></Link>
            <Link href="/me/alerts"><b><CountUp to={d.watching.length} /></b><span>prices Riya is watching</span></Link>
          </div>
        </div>
      </section>

      <div className="wrap me-body">
        {soon.map((t, i) => <LiveTrip key={t.missionId} t={t} compact={away.length > 0 || i > 0} />)}
        {d.approvals.length > 0 && <NeedsYou cards={d.approvals} />}
        {d.dues.length > 0 && (
          <section className="dues">
            {d.dues.map((x) => (
              <Link key={x.ref} href={x.payPath} className="due">
                <span className="due-ico" aria-hidden="true">🔒</span>
                <span className="due-txt"><b>{x.kind === "balance" ? "Pay the balance" : "Pay the deposit to book"}</b><small>{x.title} · {x.ref}{x.kind === "balance" && x.balanceDue ? ` · due ${fmtDate(x.balanceDue, { day: "numeric", month: "short" })}` : ""}</small></span>
                <span className="due-amt">{fmt(x.amount)} →</span>
              </Link>
            ))}
          </section>
        )}

        <section>
          <div className="me-head"><h2>Your trips</h2>{d.trips.length > 0 && <AskButton className="link-btn" q="Plan a new trip for me">+ Plan another</AskButton>}</div>
          {d.trips.length === 0 ? (
            <div className="me-empty">
              <RiyaOrb size={120} />
              <div>
                <h3>Where to next?</h3>
                <p>Tell Riya the kind of trip you want, right here or in the chat on the right. She&apos;ll find the best option, hold the price and handle visa, insurance and forex, and you&apos;ll see every step on this page.</p>
              </div>
            </div>
          ) : <div className="me-trips">{d.trips.slice(0, 4).map((t, i) => <TripCardX key={t.id} t={t} i={i} />)}</div>}
          {d.trips.length > 4 && <p style={{ marginTop: 12 }}><Link href="/me/trips">See all {d.trips.length} trips →</Link></p>}
        </section>

        <div className="me-grid">
          <section className="panel me-feed">
            <div className="me-head"><h2>What&apos;s happening</h2></div>
            <LiveFeed items={d.feed} working={working} />
          </section>
          <aside className="me-side">
            <PhoneSetup />
            <Link href="/me/alerts" className="panel me-tile tile-link">
              <h2>🔔 Price alerts</h2>
              {d.watching.length ? <ul className="tile-list">{d.watching.slice(0, 4).map((w) => <li key={w.id}><span>{w.dest}</span><span>under {fmt(w.price)}</span></li>)}</ul>
                : <p className="muted">Tap “Alert me if the price drops” on any trip and Riya checks it every morning.</p>}
            </Link>
            <Link href="/me/bookings" className="panel me-tile tile-link">
              <h2>🎟️ Bookings</h2>
              {d.bookings.length ? <ul className="tile-list">{d.bookings.slice(0, 4).map((b) => <li key={b.id}><span><small>{b.label}</small>{b.title}</span>{b.confirmation ? <code>{b.confirmation}</code> : <span className="muted">booking…</span>}</li>)}</ul>
                : <p className="muted">Confirmed flights, hotels, insurance and forex land here with their reference numbers.</p>}
            </Link>
            <Link href="/me/profile" className="panel me-tile tile-link">
              <h2>🧠 What Riya knows</h2>
              {d.memory.length ? <div className="mem-chips">{d.memory.slice(0, 6).map((m) => <span key={m} className="mem-chip on">{m}</span>)}</div> : <p className="muted">Nothing yet. Riya learns your style as you chat.</p>}
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
