"use client";
import { useMemo, useState } from "react";
import { adultPrice, addDays, fmtDate, fmtK, parseISO } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import { useBooking } from "./BookingContext";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid of departures with prices; cheapest third in green, priciest third in amber. */
export default function DepartureCalendar() {
  const { trip, departures, selected, select } = useBooking();
  const { from, currency } = usePrefs();

  const months = useMemo(() => [...new Set(departures.map((d) => d.date.slice(0, 7)))], [departures]);
  const [mi, setMi] = useState(() => Math.max(0, months.indexOf(selected?.date.slice(0, 7) ?? "")));
  const month = months[mi];

  const priced = useMemo(() => departures.map((d) => ({ ...d, p: adultPrice(trip.price, d.priceDelta, trip.flight, from) })), [departures, trip, from]);
  const byDate = useMemo(() => new Map(priced.map((d) => [d.date, d])), [priced]);
  const [lo, hi] = useMemo(() => {
    const ps = priced.map((d) => d.p).sort((a, b) => a - b);
    return [ps[Math.floor(ps.length / 3)] ?? 0, ps[Math.floor((ps.length * 2) / 3)] ?? 0];
  }, [priced]);
  const cheapest = useMemo(() => priced.reduce<typeof priced[number] | null>((m, d) => (!m || d.p < m.p ? d : m), null), [priced]);

  if (!departures.length) {
    return <div className="empty">No dates are open right now. Ask us and we&apos;ll find one that suits you.</div>;
  }

  const first = parseISO(month + "-01");
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];

  return (
    <div className="dcal">
      <div className="dcal-head">
        <button className="icon-btn" onClick={() => setMi((m) => Math.max(0, m - 1))} disabled={mi === 0} aria-label="Previous month">‹</button>
        <b aria-live="polite">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <button className="icon-btn" onClick={() => setMi((m) => Math.min(months.length - 1, m + 1))} disabled={mi === months.length - 1} aria-label="Next month">›</button>
      </div>
      <div className="dcal-grid" role="grid" aria-label="Departure dates">
        {WEEKDAYS.map((w) => <div key={w} className="dcal-wd" role="columnheader">{w}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={"x" + i} />;
          const d = byDate.get(date);
          const day = Number(date.slice(8));
          if (!d) return <div key={date} className="dcal-day off" aria-hidden="true"><span className="n">{day}</span></div>;
          const tier = d.p <= lo ? "low" : d.p >= hi ? "high" : "mid";
          const sel = selected?.id === d.id;
          return (
            <button key={date} className={`dcal-day ${tier} ${sel ? "sel" : ""}`} aria-pressed={sel} onClick={() => select(d.id)}
              aria-label={`${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}, ${fmtK(d.p, currency)} per adult${d.seatsLeft !== null ? `, ${d.seatsLeft} seats left` : ""}`}>
              <span className="n">{day}</span>
              <span className="p">{fmtK(d.p, currency)}</span>
              {d.seatsLeft !== null && d.seatsLeft <= 8 && <span className="s">{d.seatsLeft} left</span>}
            </button>
          );
        })}
      </div>
      <div className="dcal-foot">
        <span className="legend"><span><i className="lg-low" />Lower price</span><span><i className="lg-high" />Peak dates</span></span>
        {cheapest && cheapest.id !== selected?.id && (
          <button className="link-btn" onClick={() => { select(cheapest.id); setMi(months.indexOf(cheapest.date.slice(0, 7))); }}>
            Jump to cheapest: {fmtDate(cheapest.date, { day: "numeric", month: "short" })}
          </button>
        )}
      </div>
      {selected && (
        <p className="dcal-sel">
          <b>{fmtDate(selected.date, { weekday: "short", day: "numeric", month: "short" })}</b> → <b>{fmtDate(addDays(selected.date, trip.nights), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</b>
          <span className="muted"> · {trip.nights} nights</span>
        </p>
      )}
    </div>
  );
}
