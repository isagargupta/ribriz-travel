"use client";
import Image from "next/image";
import Link from "next/link";
import type { TripDTO } from "@/lib/types";
import { BOARDS, emi, fmtDate, quote, ratingWord, savingPct } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import PriceTag from "./PriceTag";
import Money from "./ui/Money";

export default function TripCard({ t, priority = false }: { t: TripDTO; priority?: boolean }) {
  const { from, adults, childAges, saved, compare, toggleSaved, toggleCompare, toast } = usePrefs();
  const save = savingPct(t);
  const on = saved.includes(t.id);
  const href = `/trips/${t.slug}`;
  const q = quote({ base: t.price, delta: t.minDelta, flight: t.flight, from, adults, childAges });
  const seatsLow = t.kind === "escorted" && t.depDates.length > 0 && t.depDates.length < 6;

  const onSave = () => {
    const nowOn = toggleSaved(t.id);
    toast(nowOn ? "Saved to your trips" : "Removed from saved trips", {
      tone: "ok",
      action: { label: "Undo", run: () => toggleSaved(t.id) },
    });
  };

  return (
    <article className="card">
      <div className="art">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="art-link">
          <Image src={t.image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" priority={priority} />
        </Link>
        <div className="tagline">
          {t.lastMinute && <span className="tag lm">Last minute</span>}
          {t.earlyBird && <span className="tag eb">Early bird</span>}
          {t.tourManager && <span className="tag tm">Tour manager</span>}
        </div>
        <button className={`heart ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? "Remove from saved trips" : "Save trip"} onClick={onSave}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
        </button>
        {save > 0 && <span className="save-badge">Save {save}%</span>}
      </div>
      <div className="body">
        <div className="loc">{t.country} · {t.nights}N/{t.nights + 1}D</div>
        <h3><Link href={href} className="stretch">{t.title}</Link></h3>
        <div className="rating"><span className="score">{t.rating.toFixed(1)}</span> {ratingWord(t.rating)} <span className="muted" style={{ fontWeight: 500 }}>· {t.reviews.toLocaleString("en-IN")} reviews</span></div>
        <div className="meta">
          <span className="pill">{"★".repeat(t.stars)}</span>
          <span className="pill">{BOARDS[t.board] ?? t.board}</span>
          {t.flight && <span className="pill">✈ Flights incl.</span>}
          {t.beach !== null && <span className="pill">{t.beach === 0 ? "On the beach" : `${t.beach} m to beach`}</span>}
          {t.freeCancel && <span className="pill good">Free cancellation</span>}
        </div>
        <div className="priceblock">
          <PriceTag base={t.price} delta={t.minDelta} flight={t.flight} board={t.board} nights={t.nights} was={t.was} cheapestDate={t.cheapestDate} />
          <span className="go-btn" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
        <div className="card-foot">
          <span className="emi">or <Money inr={emi(q.total, 6)} />/mo, 0% EMI</span>
          {t.cheapestDate
            ? <span className={seatsLow ? "warn-txt" : "muted"}>{seatsLow ? "Few dates left" : `Next: ${fmtDate(t.depDates[0], { day: "numeric", month: "short" })}`}</span>
            : <span className="muted">Dates on request</span>}
        </div>
        <label className="cmp">
          <input type="checkbox" checked={compare.includes(t.id)} onChange={() => {
            const r = toggleCompare(t.id);
            if (r === "full") toast("You can compare up to 3 trips. Remove one first.", { tone: "err" });
          }} /> Compare
        </label>
      </div>
    </article>
  );
}
