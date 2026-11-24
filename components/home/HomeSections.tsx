"use client";
import Image from "next/image";
import Consent from "@/components/legal/Consent";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { adultPrice, fmtK, parseISO } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import TripCard from "../TripCard";
import Money from "../ui/Money";

export function Ticker({ trips }: { trips: TripDTO[] }) {
  const { money, from } = usePrefs();
  const sorted = useMemo(() => [...trips].sort((a, b) => a.price + a.minDelta - (b.price + b.minDelta)), [trips]);
  return (
    <div className="ticker" aria-label="Starting prices">
      <div className="track">
        {[0, 1].map((copy) => sorted.map((t) => (
          <Link key={t.id + copy} href={`/trips/${t.slug}`} tabIndex={copy ? -1 : undefined} aria-hidden={copy ? true : undefined}>
            {t.dest} <i>{money(adultPrice(t.price, t.minDelta, t.flight, from))}</i>
          </Link>
        )))}
      </div>
    </div>
  );
}

export function Bento({ trips }: { trips: TripDTO[] }) {
  const { from } = usePrefs();
  return (
    <div className="bento">
      {trips.slice(0, 5).map((t, i) => (
        <Link className="tile" key={t.id} href={`/trips/${t.slug}`}>
          <Image src={t.image} alt="" fill sizes={i === 0 ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 900px) 50vw, 25vw"} />
          <span className="from"><em>from</em><Money inr={adultPrice(t.price, t.minDelta, t.flight, from)} /></span>
          <div className="t-in"><span className="sub">{t.country} · {t.nights} nights</span><h3>{t.dest}</h3><span className="tile-cta">See dates & prices →</span></div>
        </Link>
      ))}
    </div>
  );
}

/** Horizontal scroller with arrow buttons that appear only when there's more to see. */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [children]);
  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <div className="rail-wrap">
      <button className="rail-btn prev" onClick={() => by(-1)} hidden={edges.start} aria-label={`Scroll ${label} left`}>‹</button>
      <div className="rail" ref={ref} role="region" aria-label={label} tabIndex={0}>{children}</div>
      <button className="rail-btn next" onClick={() => by(1)} hidden={edges.end} aria-label={`Scroll ${label} right`}>›</button>
    </div>
  );
}

function useMidnightCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const n = new Date(), e = new Date(n); e.setHours(24, 0, 0, 0); setLeft(Math.max(0, Math.floor((+e - +n) / 1000))); };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return left;
}

export function Deals({ trips }: { trips: TripDTO[] }) {
  const [deal, setDeal] = useState<"lm" | "eb">("lm");
  const left = useMidnightCountdown();
  const list = trips.filter((t) => (deal === "lm" ? t.lastMinute : t.earlyBird)).sort((a, b) => a.price + a.minDelta - (b.price + b.minDelta));
  const pad = (n: number) => String(n).padStart(2, "0");
  const part = (f: (s: number) => number) => (left === null ? "--" : pad(f(left)));
  return (
    <>
      <div className="sec-head">
        <div>
          <span className="kicker">Deals</span>
          <h2>{deal === "lm" ? "Last-minute seats" : "Early-bird fares"}</h2>
          <p>{deal === "lm" ? "Leaving soon, priced to fill the last rooms. Prices shown are today's." : "Book next season now and lock today's price, with a free date change."}</p>
        </div>
        <div className="deal-ctrl">
          <div className="seg" role="group" aria-label="Deal type">
            <button aria-pressed={deal === "lm"} onClick={() => setDeal("lm")}>Last minute</button>
            <button aria-pressed={deal === "eb"} onClick={() => setDeal("eb")}>Early booking</button>
          </div>
          <div className="timer" aria-label="Time until today's prices end">Today&apos;s prices end in
            <b>{part((s) => Math.floor(s / 3600))}</b>:<b>{part((s) => Math.floor((s % 3600) / 60))}</b>:<b>{part((s) => s % 60)}</b>
          </div>
        </div>
      </div>
      <Rail label={deal === "lm" ? "Last-minute deals" : "Early-bird deals"}>
        {list.map((t) => <TripCard key={t.id} t={t} />)}
      </Rail>
      <div style={{ marginTop: 10 }}><Link className="btn" href={`/trips?deal=${deal}`}>See all {deal === "lm" ? "last-minute" : "early-bird"} trips →</Link></div>
    </>
  );
}

export function RecentlyViewed({ trips }: { trips: TripDTO[] }) {
  const { recent, ready, set } = usePrefs();
  const list = recent.map((id) => trips.find((t) => t.id === id)).filter((t): t is TripDTO => !!t);
  if (!ready || list.length === 0) return null;
  return (
    <section className="band recent" style={{ paddingBottom: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <div><span className="kicker">Pick up where you left off</span><h2>Recently viewed</h2></div>
          <button className="link-btn" onClick={() => set({ recent: [] })}>Clear history</button>
        </div>
        <Rail label="Recently viewed trips">{list.map((t) => <TripCard key={t.id} t={t} />)}</Rail>
      </div>
    </section>
  );
}

export function PriceCalendar({ days }: { days: { date: string; options: { base: number; flight: boolean }[] }[] }) {
  const { currency, from } = usePrefs();
  const rows = useMemo(() => days.map((d) => ({
    ...d,
    min: d.options.length ? Math.min(...d.options.map((o) => adultPrice(o.base, 0, o.flight, from))) : Infinity,
    count: d.options.length,
  })), [days, from]);
  const vals = rows.map((x) => x.min).filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const cheapest = new Set([...rows].filter((r) => Number.isFinite(r.min)).sort((a, b) => a.min - b.min).slice(0, 3).map((x) => x.date));

  return (
    <div className="cal-card">
      <div className="sec-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="kicker">Price calendar</span>
          <h2 style={{ fontSize: "clamp(22px,2.8vw,30px)" }}>Cheapest days to leave</h2>
          <p>The lowest price per adult on each day across every trip, from {from}. Tap a day to see what leaves then.</p>
        </div>
      </div>
      <div className="cal">
        {rows.map((x) => {
          const d = parseISO(x.date);
          const has = Number.isFinite(x.min);
          return (
            <Link key={x.date} href={has ? `/trips?date=${x.date}&flex=0` : "/trips"} className={`${cheapest.has(x.date) ? "cheap" : ""} ${has ? "" : "none"}`}
              aria-label={`${d.toDateString()}: ${has ? `${x.count} departures from ${fmtK(x.min, currency)}` : "no departures"}`}>
              <span className="p">{has ? fmtK(x.min, currency) : "—"}</span>
              <span className="col" style={{ ["--h" as string]: has ? `${hi > lo ? 30 + (65 * (x.min - lo)) / (hi - lo) : 50}%` : "0%" }} />
              <span className="n">{d.getDate()}</span>
              <span className="d">{d.toLocaleDateString("en-GB", { weekday: "short" })}<br />{d.toLocaleDateString("en-GB", { month: "short" })}</span>
            </Link>
          );
        })}
      </div>
      <div className="legend"><span><i style={{ background: "var(--mint)" }} />3 cheapest days</span><span><i style={{ background: "var(--blue)" }} />Taller bar = higher price</span></div>
    </div>
  );
}

export function Newsletter() {
  const { toast } = usePrefs();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if (r.ok) { setDone(true); setEmail(""); } else toast(j.error || "Could not subscribe. Try again.", { tone: "err" });
    } catch { toast("You seem to be offline. Try again.", { tone: "err" }); }
    setBusy(false);
  }
  return (
    <div className="cta">
      <div><h2>Get price drops before anyone else</h2><p>We email you when there&apos;s a deal worth it: big price drops and last-minute seats. Unsubscribe any time.</p></div>
      {done ? <p className="cta-done pop-in">You&apos;re in. We&apos;ll email you when there&apos;s a deal worth it.</p> : (
        <form onSubmit={submit}>
          <input type="email" required placeholder="Your email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? <span className="spinner light" aria-label="Saving" /> : "Notify me"}</button>
        </form>
      )}
      {!done && <Consent action="subscribing" />}
    </div>
  );
}
