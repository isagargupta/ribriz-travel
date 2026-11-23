"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { fmt, fmtK, isoDate, ppPrice, seeded } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import TripCard from "../TripCard";

export function Ticker({ trips }: { trips: TripDTO[] }) {
  const { currency, from } = usePrefs();
  const sorted = [...trips].sort((a, b) => ppPrice(a, from) - ppPrice(b, from));
  const items = [...sorted, ...sorted];
  return (
    <div className="ticker" aria-label="Starting prices">
      <div className="track">
        {items.map((t, i) => (
          <Link key={t.id + i} href={`/trips/${t.slug}`} tabIndex={i >= sorted.length ? -1 : undefined}>
            {t.dest} <i>{fmt(ppPrice(t, from), currency)}</i>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Bento({ trips }: { trips: TripDTO[] }) {
  const { currency, from } = usePrefs();
  return (
    <div className="bento">
      {trips.slice(0, 5).map((t) => (
        <Link className="tile" key={t.id} href={`/trips/${t.slug}`}>
          <img src={t.image} alt="" loading="lazy" />
          <span className="from"><em>from</em>{fmt(ppPrice(t, from), currency)}</span>
          <div className="t-in"><span className="sub">{t.country} · {t.nights} nights</span><h3>{t.dest}</h3></div>
        </Link>
      ))}
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
  const { from } = usePrefs();
  const left = useMidnightCountdown();
  const list = trips.filter((t) => (deal === "lm" ? t.lastMinute : t.earlyBird)).sort((a, b) => ppPrice(a, from) - ppPrice(b, from));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <>
      <div className="sec-head">
        <div>
          <span className="kicker">Deals</span>
          <h2>{deal === "lm" ? "Last-minute seats" : "Early-bird fares"}</h2>
          <p>{deal === "lm" ? "Departures in the next 21 days, priced to fill the last rooms." : "Book next season now and lock today's price, with a free date change."}</p>
        </div>
        <div style={{ display: "grid", gap: 12, justifyItems: "end" }}>
          <div className="seg" role="group" aria-label="Deal type">
            <button aria-pressed={deal === "lm"} onClick={() => setDeal("lm")}>Last minute</button>
            <button aria-pressed={deal === "eb"} onClick={() => setDeal("eb")}>Early booking</button>
          </div>
          <div className="timer">Today&apos;s prices end in
            <b>{left === null ? "--" : pad(Math.floor(left / 3600))}</b>:<b>{left === null ? "--" : pad(Math.floor((left % 3600) / 60))}</b>:<b>{left === null ? "--" : pad(left % 60)}</b>
          </div>
        </div>
      </div>
      <div className="rail">{list.map((t) => <TripCard key={t.id} t={t} />)}</div>
      <div style={{ marginTop: 10 }}><Link className="btn" href={`/trips?deal=${deal}`}>See all {deal === "lm" ? "last-minute" : "early-bird"} trips →</Link></div>
    </>
  );
}

export function PriceCalendar({ trips }: { trips: TripDTO[] }) {
  const { currency, from } = usePrefs();
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => setBase(isoDate(new Date())), []);

  const days = useMemo(() => {
    if (!base) return [];
    const b = new Date(base + "T00:00:00");
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(b); d.setDate(b.getDate() + i);
      const key = isoDate(d);
      let min = Infinity;
      for (const t of trips) {
        const f = 0.85 + seeded(t.id + key) * 0.35 + (d.getDay() === 5 || d.getDay() === 6 ? 0.06 : 0);
        min = Math.min(min, ppPrice(t, from) * f);
      }
      return { d, key, min };
    });
  }, [base, trips, from]);

  const vals = days.map((x) => x.min).filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const cheapest = [...days].sort((a, b) => a.min - b.min).slice(0, 3).map((x) => x.key);

  return (
    <div className="cal-card">
      <div className="sec-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="kicker">Price calendar</span>
          <h2 style={{ fontSize: "clamp(22px,2.8vw,30px)" }}>Cheapest days to leave</h2>
          <p>Lowest per-person price across {trips.length} trips from {from}. Tap a day to see trips leaving then.</p>
        </div>
      </div>
      <div className="cal">
        {days.map((x) => (
          <Link key={x.key} href={`/trips?date=${x.key}&flex=0`} className={cheapest.includes(x.key) ? "cheap" : ""}
            aria-label={`${x.d.toDateString()}, from ${fmt(x.min, currency)}`}>
            <span className="p">{Number.isFinite(x.min) ? fmtK(x.min, currency) : "—"}</span>
            <span className="col" style={{ ["--h" as string]: `${hi > lo ? 30 + (65 * (x.min - lo)) / (hi - lo) : 40}%` }} />
            <span className="n">{x.d.getDate()}</span>
            <span className="d">{x.d.toLocaleDateString("en-GB", { weekday: "short" })}<br />{x.d.toLocaleDateString("en-GB", { month: "short" })}</span>
          </Link>
        ))}
      </div>
      <div className="legend"><span><i style={{ background: "var(--mint)" }} />3 cheapest days</span><span><i style={{ background: "var(--blue)" }} />Lowest price per person that day (taller = pricier)</span></div>
    </div>
  );
}

export function Newsletter() {
  const { toast } = usePrefs();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      toast(r.ok ? "You're on the list. Watch your inbox for price drops." : j.error || "Could not subscribe. Try again.");
      if (r.ok) setEmail("");
    } catch { toast("Network error. Check your connection and try again."); }
    setBusy(false);
  }
  return (
    <div className="cta">
      <div><h2>Get price drops before anyone else</h2><p>One email a week with flash sales from your city. Unsubscribe in one click.</p></div>
      <form onSubmit={submit}>
        <input type="email" required placeholder="Your email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Notify me"}</button>
      </form>
    </div>
  );
}
