"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveTrip as LT } from "@/lib/live";
import { fmtDate } from "@/lib/pricing";
import { askRiya } from "../assistant/Assistant";

function useClock(tz: string) {
  const [now, setNow] = useState<string | null>(null); // null on the server so the markup matches
  useEffect(() => {
    const f = () => setNow(new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }));
    f();
    const t = setInterval(f, 15_000);
    return () => clearInterval(t);
  }, [tz]);
  return now;
}

function useTicks(key: string) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { /* private mode */ } }, [key]);
  const toggle = (id: string) => setDone((cur) => {
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  return { done, toggle };
}

/**
 * The trip as it happens. In the 3 days before departure: a countdown and a
 * tick-off checklist. On the trip: day N of M, today's and tomorrow's plan,
 * local time and weather, emergency numbers, booking references and help.
 */
export default function LiveTrip({ t, compact = false }: { t: LT; compact?: boolean }) {
  const clock = useClock(t.tz);
  const { done, toggle } = useTicks(`ribriz-pack-${t.missionId}`);
  const travelling = t.phase === "on_trip" || t.phase === "departure_day";
  const head = t.phase === "leaving_soon" ? `Leaving in ${t.daysToGo} day${t.daysToGo > 1 ? "s" : ""}`
    : t.phase === "departure_day" ? "Today's the day" : `Day ${t.day} of ${t.totalDays}`;
  const ready = t.checklist.filter((c) => done.includes(c.id)).length;

  return (
    <section className={`live ${travelling ? "on" : "soon"}`} aria-label={`${t.dest}: ${head}`}>
      <div className="live-hero">
        <Image src={t.image} alt="" fill sizes="(max-width: 900px) 100vw, 900px" priority />
        <div className="live-hero-in">
          <div className="live-kicker"><span className="live-pill"><i /> {travelling ? "Live trip" : "Almost time"}</span><span>{fmtDate(t.date, { day: "numeric", month: "short" })} – {fmtDate(t.returnDate, { day: "numeric", month: "short" })}</span></div>
          <h2>{head}{travelling ? <> in {t.dest}</> : <> for {t.dest} <span aria-hidden="true">✈</span></>}</h2>
          {travelling && (
            <div className="live-days" aria-hidden="true">
              {Array.from({ length: t.totalDays }, (_, i) => <i key={i} className={i + 1 < (t.day ?? 0) ? "past" : i + 1 === t.day ? "now" : ""} />)}
            </div>
          )}
          <div className="live-facts">
            <span>🕐 {clock ?? "--:--"} local <small>· {t.offset}</small></span>
            {t.weather && <span>{t.weather.icon} {t.weather.now}° {t.weather.label} <small>· {t.weather.max}°/{t.weather.min}°{t.weather.rain !== null ? ` · ${t.weather.rain}% rain` : ""}</small></span>}
          </div>
        </div>
      </div>

      <div className="live-body">
        {travelling ? (
          <div className="live-plan">
            <div className="live-today"><small>Today</small><b>{t.today ?? "Free time: enjoy!"}</b></div>
            {t.tomorrow && <div className="live-tmr"><small>Tomorrow{t.weather?.tomorrow ? ` · ${t.weather.tomorrow.icon} ${t.weather.tomorrow.max}°` : ""}</small><span>{t.tomorrow}</span></div>}
            <div className="live-acts">
              <button type="button" className="btn hot sm" onClick={() => askRiya(`I'm in ${t.dest} on day ${t.day} of my trip. What do you suggest I do or eat nearby today?`)}>✦ Ideas for today</button>
              <button type="button" className="btn sm" onClick={() => askRiya(`I need help on my ${t.dest} trip right now.`)}>I need help</button>
            </div>
          </div>
        ) : (
          <div className="live-check">
            <div className="live-check-head"><b>Before you go</b><span>{ready}/{t.checklist.length} ready</span></div>
            <ul>
              {t.checklist.map((c) => (
                <li key={c.id}>
                  <label className={done.includes(c.id) ? "ok" : ""}>
                    <input type="checkbox" checked={done.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span>{c.text}</span>
                  </label>
                </li>
              ))}
            </ul>
            {t.weather && <p className="muted live-wx">Forecast on arrival: {t.weather.icon} {t.weather.max}°/{t.weather.min}°, {t.weather.label.toLowerCase()}.</p>}
          </div>
        )}

        {!compact && (
          <div className="live-side">
            <div className="live-card sos">
              <b>Emergency{t.countryName ? ` · ${t.countryName}` : ""}</b>
              <ul>{t.emergency.map((e) => <li key={e.number}><span>{e.label}</span><a href={`tel:${e.number}`}>{e.number}</a></li>)}</ul>
              <small>Then message Riya or <a href="mailto:hello@ribriztravel.com">hello@ribriztravel.com</a> and we&apos;ll take it from there.</small>
            </div>
            {t.bookings.length > 0 && (
              <div className="live-card">
                <b>Your references</b>
                <ul>{t.bookings.map((b) => <li key={b.confirmation}><span>{b.label}</span><code>{b.confirmation}</code></li>)}</ul>
              </div>
            )}
            <div className="live-card">
              <b>Good to know</b>
              <ul>
                {t.currency && <li><span>Money</span><span>{t.currency}</span></li>}
                {t.plug && <li><span>Plugs</span><span>Type {t.plug}</span></li>}
              </ul>
              <Link href="/me/wallet" className="link-btn">🗂️ Open your wallet (works offline) →</Link>
            </div>
          </div>
        )}
        {compact && <Link href={`/me/trips/${t.missionId}`} className="link-btn live-more">Emergency numbers, references and more →</Link>}
      </div>
    </section>
  );
}
