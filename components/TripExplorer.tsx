"use client";
import { usePathname } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { BOARDS, KINDS, THEMES, adultPrice, addDays, fmtDate, savingPct } from "@/lib/pricing";
import { MAX_BUDGET, parseFilters, toQuery, type Filters } from "@/lib/filters";
import { scoreFields, tripFields } from "@/lib/search";
import { usePrefs } from "./Prefs";
import TripCard from "./TripCard";
import Sheet from "./ui/Sheet";

type Ignore = "region" | "board" | "kind" | null;

/** Does a trip pass every active filter (optionally skipping one, for facet counts)? */
function passes(t: TripDTO, f: Filters, from: string, ignore: Ignore = null) {
  if (ignore !== "kind" && f.kind && t.kind !== f.kind) return false;
  if (f.theme && !t.themes.includes(f.theme)) return false;
  if (f.deal === "lm" && !t.lastMinute) return false;
  if (f.deal === "eb" && !t.earlyBird) return false;
  if (f.nights) { const [a, b] = f.nights.split("-").map(Number); if (t.nights < a || t.nights > b) return false; }
  if (adultPrice(t.price, t.minDelta, t.flight, from) > f.budget) return false;
  if (ignore !== "region" && f.regions.length && !f.regions.includes(t.region)) return false;
  if (f.stars.length && !f.stars.includes(t.stars)) return false;
  if (ignore !== "board" && f.boards.length && !f.boards.includes(t.board)) return false;
  if (f.free && !t.freeCancel) return false;
  if (f.flight && !t.flight) return false;
  if (f.beach && !(t.beach !== null && t.beach <= 300)) return false;
  if (f.tm && !t.tourManager) return false;
  if (f.visa && !t.easyVisa) return false;
  if (f.date) {
    const flex = Number(f.flex || 3), lo = addDays(f.date, -flex), hi = addDays(f.date, flex);
    if (!t.depDates.some((d) => d >= lo && d <= hi)) return false;
  }
  return true;
}

export default function TripExplorer({ trips, initial }: { trips: TripDTO[]; initial: Filters }) {
  const path = usePathname();
  const { from, money } = usePrefs();
  const [f, setF] = useState<Filters>(initial);
  const [sheet, setSheet] = useState(false);
  const q = useDeferredValue(f.q); // typing stays instant while results catch up

  useEffect(() => {
    const qs = toQuery(f);
    window.history.replaceState(window.history.state, "", qs ? `${path}?${qs}` : path);
  }, [f, path]);

  const upd = (p: Partial<Filters>) => setF((cur) => ({ ...cur, ...p }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // text relevance computed once per query
  const relevance = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trips) m.set(t.id, q.trim() ? scoreFields(q, tripFields(t)) : 1);
    return m;
  }, [trips, q]);
  const pool = useMemo(() => trips.filter((t) => (relevance.get(t.id) ?? 0) > 0), [trips, relevance]);

  const list = useMemo(() => {
    const price = (t: TripDTO) => adultPrice(t.price, t.minDelta, t.flight, from);
    const sorters: Record<string, (a: TripDTO, b: TripDTO) => number> = {
      rec: (a, b) => (q.trim() ? (relevance.get(b.id)! - relevance.get(a.id)!) * 1000 : 0)
        + (b.rating * 1000 - price(b) / 400 + (b.featured ? 300 : 0)) - (a.rating * 1000 - price(a) / 400 + (a.featured ? 300 : 0)),
      price: (a, b) => price(a) - price(b),
      rating: (a, b) => b.rating - a.rating,
      deal: (a, b) => savingPct(b) - savingPct(a),
      nights: (a, b) => a.nights - b.nights,
    };
    return pool.filter((t) => passes(t, f, from)).sort(sorters[f.sort] ?? sorters.rec);
  }, [pool, f, from, q, relevance]);

  const regions = useMemo(() => [...new Set(trips.map((t) => t.region))].sort(), [trips]);
  const boards = Object.keys(BOARDS).filter((b) => trips.some((t) => t.board === b));
  const count = (ignore: Ignore, test: (t: TripDTO) => boolean) => pool.filter((t) => test(t) && passes(t, f, from, ignore)).length;

  const chips: [string, () => void][] = [];
  if (f.kind) chips.push([KINDS[f.kind] ?? f.kind, () => upd({ kind: "" })]);
  if (f.q) chips.push([`“${f.q}”`, () => upd({ q: "" })]);
  if (f.theme) chips.push([THEMES.find((t) => t.key === f.theme)?.label ?? f.theme, () => upd({ theme: "" })]);
  if (f.deal) chips.push([f.deal === "lm" ? "Last minute" : "Early bird", () => upd({ deal: "" })]);
  if (f.nights) chips.push([`${f.nights.replace("-", "–")} nights`, () => upd({ nights: "" })]);
  if (f.date) chips.push([`Leaving ${fmtDate(f.date, { day: "numeric", month: "short" })}${Number(f.flex || 3) ? ` ±${f.flex || 3}d` : ""}`, () => upd({ date: "", flex: "" })]);
  if (f.budget < MAX_BUDGET) chips.push([`Under ${money(f.budget)}`, () => upd({ budget: MAX_BUDGET })]);
  f.regions.forEach((r) => chips.push([r, () => upd({ regions: f.regions.filter((x) => x !== r) })]));
  f.stars.forEach((s) => chips.push([`${s}★`, () => upd({ stars: f.stars.filter((x) => x !== s) })]));
  f.boards.forEach((b) => chips.push([BOARDS[b], () => upd({ boards: f.boards.filter((x) => x !== b) })]));
  ([["free", "Free cancellation"], ["flight", "Flights included"], ["beach", "Near the beach"], ["tm", "Tour manager"], ["visa", "Easy visa"]] as const)
    .forEach(([k, l]) => { if (f[k]) chips.push([l, () => upd({ [k]: false } as Partial<Filters>)]); });

  const reset = () => setF({ ...parseFilters({}), sort: f.sort });
  const activeCount = chips.length;

  const panel = (
    <div className="filter-body">
      <div>
        <h4>Search</h4>
        <div className="search-in">
          <input className="in" placeholder="Destination, country or style" value={f.q} onChange={(e) => upd({ q: e.target.value })} aria-label="Search trips" />
          {f.q && <button className="clear-x" onClick={() => upd({ q: "" })} aria-label="Clear search">✕</button>}
        </div>
      </div>
      <div>
        <h4>Trip type</h4>
        <div className="chips">
          <button aria-pressed={!f.kind} onClick={() => upd({ kind: "" })}>All</button>
          {Object.entries(KINDS).map(([k, l]) => <button key={k} aria-pressed={f.kind === k} onClick={() => upd({ kind: f.kind === k ? "" : k })}>{l} <small>{count("kind", (t) => t.kind === k)}</small></button>)}
        </div>
      </div>
      <div>
        <h4>Budget per adult</h4>
        <input type="range" min={20000} max={MAX_BUDGET} step={5000} value={f.budget} onChange={(e) => upd({ budget: Number(e.target.value) })} aria-label="Maximum price per adult" />
        <div className="range-lbl"><span>{money(20000)}</span><b>{f.budget >= MAX_BUDGET ? "Any price" : `up to ${money(f.budget)}`}</b></div>
      </div>
      <div>
        <h4>Region</h4>
        {regions.map((r) => {
          const n = count("region", (t) => t.region === r);
          return <label className={`chk ${n === 0 && !f.regions.includes(r) ? "dim" : ""}`} key={r}><input type="checkbox" checked={f.regions.includes(r)} onChange={() => upd({ regions: toggle(f.regions, r) })} /> {r}<span className="ct">{n}</span></label>;
        })}
      </div>
      <div>
        <h4>Hotel stars</h4>
        <div className="chips">{[3, 4, 5].map((s) => <button key={s} aria-pressed={f.stars.includes(s)} onClick={() => upd({ stars: toggle(f.stars, s) })}>{s}★</button>)}</div>
      </div>
      <div>
        <h4>Meal plan</h4>
        {boards.map((b) => {
          const n = count("board", (t) => t.board === b);
          return <label className={`chk ${n === 0 && !f.boards.includes(b) ? "dim" : ""}`} key={b}><input type="checkbox" checked={f.boards.includes(b)} onChange={() => upd({ boards: toggle(f.boards, b) })} /> {BOARDS[b]}<span className="ct">{n}</span></label>;
        })}
      </div>
      <div>
        <h4>Must have</h4>
        <label className="chk"><input type="checkbox" checked={f.free} onChange={(e) => upd({ free: e.target.checked })} /> Free cancellation</label>
        <label className="chk"><input type="checkbox" checked={f.flight} onChange={(e) => upd({ flight: e.target.checked })} /> Flights included</label>
        <label className="chk"><input type="checkbox" checked={f.beach} onChange={(e) => upd({ beach: e.target.checked })} /> Beach within 300 m</label>
        <label className="chk"><input type="checkbox" checked={f.tm} onChange={(e) => upd({ tm: e.target.checked })} /> Tour manager on trip</label>
        <label className="chk"><input type="checkbox" checked={f.visa} onChange={(e) => upd({ visa: e.target.checked })} /> Visa on arrival / e-visa</label>
      </div>
    </div>
  );

  return (
    <div className="results">
      <aside className="filters desktop-only" aria-label="Filters">
        {panel}
        {activeCount > 0 && <button className="btn" onClick={reset}>Clear all filters</button>}
      </aside>

      <div style={{ minWidth: 0 }}>
        <div className="toolbar">
          <div>
            <strong aria-live="polite">{list.length} {list.length === 1 ? "trip" : "trips"} <span className="muted" style={{ fontWeight: 600, fontSize: 15 }}>from {from}</span></strong>
            {chips.length > 0 && <div className="active-chips">{chips.map(([l, fn]) => <button key={l} onClick={fn} aria-label={`Remove filter: ${l}`}>{l} <span aria-hidden="true">✕</span></button>)}</div>}
          </div>
          <div className="toolbar-r">
            <button className="btn mobile-only" onClick={() => setSheet(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              Filters{activeCount ? ` (${activeCount})` : ""}
            </button>
            <label className="sort">Sort
              <select value={f.sort} onChange={(e) => upd({ sort: e.target.value })}>
                <option value="rec">Recommended</option>
                <option value="price">Lowest price</option>
                <option value="rating">Guest rating</option>
                <option value="deal">Biggest saving</option>
                <option value="nights">Shortest trip</option>
              </select>
            </label>
          </div>
        </div>
        {list.length ? (
          <div className="grid stagger" key={toQuery({ ...f, q })}>
            {list.map((t, i) => <TripCard key={t.id} t={t} priority={i < 3} />)}
          </div>
        ) : (
          <div className="empty">
            <h3>No trips match all of these</h3>
            <p>Try removing a filter{f.date ? ", widening your dates" : ""} or raising your budget.</p>
            <div className="chips" style={{ justifyContent: "center" }}>
              {chips.slice(0, 4).map(([l, fn]) => <button key={l} onClick={fn}>Remove “{l}”</button>)}
            </div>
            <button className="btn primary" onClick={reset} style={{ marginTop: 14 }}>Clear all filters</button>
          </div>
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters"
        footer={<div className="co-foot"><button className="btn" onClick={reset}>Clear all</button><button className="btn hot" onClick={() => setSheet(false)}>Show {list.length} trip{list.length === 1 ? "" : "s"}</button></div>}>
        {panel}
      </Sheet>
    </div>
  );
}
