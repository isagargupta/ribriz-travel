import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/auth/ProfileForm";
import CommandBar from "@/components/me/CommandBar";
import Constellation from "@/components/me/Constellation";
import CountUp from "@/components/me/CountUp";
import LiveFeed from "@/components/me/LiveFeed";
import LiveRefresh from "@/components/me/LiveRefresh";
import NeedsYou from "@/components/me/NeedsYou";
import RiyaOrb from "@/components/me/RiyaOrb";
import TypedStatus from "@/components/me/TypedStatus";
import AskButton from "@/components/me/AskButton";
import { currentCustomer } from "@/lib/customer";
import { getDashboard } from "@/lib/dashboard";
import { getOwner } from "@/lib/owner";
import { fmt, fmtDate } from "@/lib/pricing";
import "./me.css";

export const metadata: Metadata = { title: "Your travel HQ", robots: { index: false } };
export const dynamic = "force-dynamic";

const REQ: Record<string, string> = { hold: "Price hold", enquiry: "Question", custom: "Custom trip", visa: "Visa", forex: "Forex", insurance: "Insurance", flight: "Flights", hotel: "Hotel" };
const REQ_STATUS: Record<string, string> = { new: "Received", contacted: "In progress", booked: "Booked", closed: "Closed" };
const WORKING: Record<string, string> = { in_progress: "is sorting", waiting: "is chasing our team about" };
const TASK_PHRASE: Record<string, string> = { choose_trip: "the best trip and date", price_hold: "your price hold", visa: "your visa", insurance: "travel insurance", forex: "your forex", flights: "your flights", hotels: "your hotels", prep: "your pre-trip checklist" };

export default async function Me() {
  const me = await currentCustomer();
  if (!me) redirect("/login?next=/me");
  const owner = await getOwner();
  const d = await getDashboard(owner, me);
  const first = d.name?.split(" ")[0];
  const working = d.trips.flatMap((t) => t.tasks.filter((x) => WORKING[x.status]).map((x) => `${WORKING[x.status]} ${TASK_PHRASE[x.kind] ?? x.title.toLowerCase()} for ${t.dest ?? t.title}`));
  const mood = d.approvals.length ? "attention" : working.length ? "working" : "idle";
  const next = d.trips.filter((t) => t.daysToGo !== null && t.daysToGo >= 0).sort((a, b) => a.daysToGo! - b.daysToGo!)[0];

  return (
    <div className="me">
      <section className="me-hero">
        <div className="me-aurora" aria-hidden="true" />
        <div className="wrap me-hero-in">
          <div className="me-hello">
            <div className="me-kicker"><span>Your travel HQ</span><LiveRefresh /></div>
            <h1>{first ? <>Hi {first} <span className="wave" aria-hidden="true">👋</span></> : "Welcome back"}</h1>
            <TypedStatus lines={d.status.map((s) => s[0].toUpperCase() + s.slice(1) + ".")} />
            <CommandBar />
          </div>
          <div className="me-orb"><RiyaOrb mood={mood} /></div>
        </div>
        <div className="wrap">
          <div className="me-stats">
            <div><b><CountUp to={d.trips.length} /></b><span>trip{d.trips.length === 1 ? "" : "s"} in motion</span></div>
            <div><b>{next ? <CountUp to={next.daysToGo!} /> : "–"}</b><span>{next ? `days to ${next.dest}` : "next trip: not booked yet"}</span></div>
            <div><b><CountUp to={d.bookings.filter((b) => b.status === "booked").length} /></b><span>bookings confirmed</span></div>
            <div><b><CountUp to={d.watching.length} /></b><span>prices Riya is watching</span></div>
          </div>
        </div>
      </section>

      <div className="wrap me-body">
        {d.approvals.length > 0 && <NeedsYou cards={d.approvals} />}

        <section>
          <div className="me-head"><h2>Your trips</h2>{d.trips.length > 0 && <AskButton className="link-btn" q="Plan a new trip for me">+ Plan another</AskButton>}</div>
          {d.trips.length === 0 ? (
            <div className="me-empty">
              <RiyaOrb size={120} />
              <div>
                <h3>Where to next?</h3>
                <p>Tell Riya the kind of trip you want. She&apos;ll find the best option, hold the price and handle visa, insurance and forex, step by step, right here.</p>
              </div>
            </div>
          ) : (
            <div className="me-trips">
              {d.trips.map((t, i) => (
                <article key={t.id} className="trip-x" style={{ ["--i" as string]: i }}>
                  <header>
                    {t.image && <Image src={t.image} alt="" fill sizes="(max-width: 800px) 100vw, 560px" />}
                    <div className="trip-x-top">
                      <div>
                        <h3>{t.dest ?? t.title}</h3>
                        <p>{t.date ? `${fmtDate(t.date)} – ${fmtDate(t.returnDate!, { day: "numeric", month: "short", year: "numeric" })}` : "Dates not chosen yet"}</p>
                      </div>
                      {t.daysToGo !== null && t.daysToGo >= 0 && <span className="trip-x-count">{t.daysToGo === 0 ? "Today!" : <><b>{t.daysToGo}</b> days</>}</span>}
                    </div>
                  </header>
                  <Constellation tasks={t.tasks} image={t.image} label={t.title} />
                  <footer>
                    <div className="trip-x-bar" aria-label={`${t.progress}% done`}><i style={{ width: `${t.progress}%` }} /></div>
                    <div className="trip-x-foot">
                      <span>{t.needsYou ? <b className="warn-txt">{t.needsYou} waiting for your OK</b> : <>Next: <b>{t.next}</b></>}</span>
                      <span className="trip-x-links"><AskButton q={`Let's continue my trip "${t.title}" (mission ${t.id}). What's next?`}>Ask Riya</AskButton><Link className="btn sm" href={`/hub/${t.id}`}>Open</Link></span>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="me-grid">
          <section className="panel me-feed">
            <div className="me-head"><h2>What&apos;s happening</h2></div>
            <LiveFeed items={d.feed} working={working} />
          </section>

          <aside className="me-side">
            <section className="panel me-tile">
              <h2>🔔 Price alerts</h2>
              {d.watching.length ? (
                <ul className="tile-list">{d.watching.map((w) => <li key={w.id}><Link href={`/trips/${w.slug}`}>{w.dest}</Link><span>under {fmt(w.price)}</span></li>)}</ul>
              ) : <p className="muted">Tap “Alert me if the price drops” on any trip and Riya checks it every morning.</p>}
            </section>
            <section className="panel me-tile">
              <h2>🎟️ Bookings</h2>
              {d.bookings.length ? (
                <ul className="tile-list">{d.bookings.map((b) => <li key={b.id}><span><small>{b.label}</small>{b.title}</span>{b.confirmation ? <code>{b.confirmation}</code> : <span className="muted">booking…</span>}</li>)}</ul>
              ) : <p className="muted">Confirmed flights, hotels, insurance and forex land here with their reference numbers.</p>}
            </section>
            <section className="panel me-tile">
              <h2>🧠 What Riya knows</h2>
              {d.memory.length ? <div className="mem-chips">{d.memory.slice(0, 6).map((m) => <span key={m} className="mem-chip on">{m}</span>)}</div> : <p className="muted">Nothing yet. Riya learns your style as you chat.</p>}
              <Link className="link-btn" href="/you">See and edit →</Link>
            </section>
          </aside>
        </div>

        <details className="panel me-more">
          <summary>Your details, requests and past trips</summary>
          <div className="me-more-in">
            <div>
              <h3>Your details</h3>
              <p className="muted" style={{ marginTop: -4 }}>Signed in as <b>{d.email}</b>. Used to fill in your bookings.</p>
              <ProfileForm name={me.name ?? ""} phone={me.phone ?? ""} />
              <form action="/api/logout" method="post" style={{ marginTop: 14 }}><button className="btn sm">Sign out</button></form>
            </div>
            <div>
              <h3>Requests</h3>
              {d.requests.length ? (
                <ul className="tile-list">{d.requests.map((r) => <li key={r.ref}><span><small>{REQ[r.type] ?? r.type} · {r.ref}</small><Link href={`/booking?ref=${r.ref}`}>{r.title ?? REQ[r.type]}</Link></span><span className={`status ${r.status}`}>{REQ_STATUS[r.status] ?? r.status}</span></li>)}</ul>
              ) : <p className="muted">None yet.</p>}
              {d.past.length > 0 && (<><h3 style={{ marginTop: 18 }}>Past trips</h3><ul className="tile-list">{d.past.map((t) => <li key={t.id}><Link href={`/hub/${t.id}`}>{t.dest ?? t.title}</Link><span className="muted">{t.date ? fmtDate(t.date, { month: "short", year: "numeric" }) : ""}</span></li>)}</ul></>)}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
