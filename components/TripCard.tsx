"use client";
import Link from "next/link";
import type { TripDTO } from "@/lib/types";
import { BOARDS, emi, fmt, ppPrice, ratingWord, savingPct, FROM_CITIES } from "@/lib/pricing";
import { usePrefs } from "./Prefs";

export default function TripCard({ t }: { t: TripDTO }) {
  const { currency, from, saved, compare, toggleSaved, toggleCompare, toast } = usePrefs();
  const pp = ppPrice(t, from);
  const save = savingPct(t);
  const on = saved.includes(t.id);
  const href = `/trips/${t.slug}`;

  return (
    <article className="card">
      <div className="art">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <img src={t.image} alt="" loading="lazy" decoding="async" />
        </Link>
        <div className="tagline">
          {t.lastMinute && <span className="tag lm">Last minute</span>}
          {t.earlyBird && <span className="tag eb">Early bird</span>}
          {t.tourManager && <span className="tag tm">Tour manager</span>}
        </div>
        <button className={`heart ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? "Remove from saved trips" : "Save trip"}
          onClick={() => toast(toggleSaved(t.id) ? "♥ Saved to your trips" : "Removed from saved trips")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
        </button>
        {save > 0 && <span className="save-badge">Save {save}%</span>}
      </div>
      <div className="body">
        <div className="loc">{t.country} · {t.nights}N/{t.nights + 1}D</div>
        <h3><Link href={href}>{t.title}</Link></h3>
        <div className="rating"><span className="score">{t.rating.toFixed(1)}</span> {ratingWord(t.rating)} <span className="muted" style={{ fontWeight: 500 }}>· {t.reviews.toLocaleString("en-IN")}</span></div>
        <div className="meta">
          <span className="pill">{"★".repeat(t.stars)}</span>
          <span className="pill">{BOARDS[t.board] ?? t.board}</span>
          {t.flight && <span className="pill">✈ incl.</span>}
          {t.beach !== null && <span className="pill">{t.beach === 0 ? "On the beach" : `${t.beach} m to beach`}</span>}
          {t.freeCancel && <span className="pill good">Free cancellation</span>}
        </div>
        <div className="priceblock">
          <div>
            {t.was && <div className="was">{fmt(t.was + (t.flight ? FROM_CITIES[from] ?? 0 : 0), currency)}</div>}
            <div className="price">{fmt(pp, currency)} <small>/ person</small></div>
            <div className="emi">{fmt(emi(pp, 6), currency)}/mo · 0% EMI</div>
          </div>
          <Link className="go-btn" href={href} aria-label={`View ${t.title}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
        <label className="cmp">
          <input type="checkbox" checked={compare.includes(t.id)} onChange={() => {
            const r = toggleCompare(t.id);
            if (r === "full") toast("Compare up to 3 trips at a time");
          }} /> Add to compare
        </label>
      </div>
    </article>
  );
}
