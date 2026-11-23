"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { BOARDS, KINDS, THEMES, fmt, ppPrice, savingPct } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import TripCard from "./TripCard";

import { MAX_BUDGET, parseFilters, toQuery, type Filters } from "@/lib/filters";

function matches(t: TripDTO, f: Filters, from: string, ignore?: "region" | "board") {
  if (f.kind && t.kind !== f.kind) return false;
  if (f.q) { const q = f.q.toLowerCase(); if (!`${t.dest} ${t.country} ${t.region} ${t.title}`.toLowerCase().includes(q)) return false; }
  if (f.theme && !t.themes.includes(f.theme)) return false;
  if (f.deal === "lm" && !t.lastMinute) return false;
  if (f.deal === "eb" && !t.earlyBird) return false;
  if (f.nights) { const [a, b] = f.nights.split("-").map(Number); if (t.nights < a || t.nights > b) return false; }
  if (ppPrice(t, from) > f.budget) return false;
  if (ignore !== "region" && f.regions.length && !f.regions.includes(t.region)) return false;
  if (f.stars.length && !f.stars.includes(t.stars)) return false;
  if (ignore !== "board" && f.boards.length && !f.boards.includes(t.board)) return false;
  if (f.free && !t.freeCancel) return false;
  if (f.flight && !t.flight) return false;
  if (f.beach && !(t.beach !== null && t.beach <= 300)) return false;
  if (f.tm && !t.tourManager) return false;
  if (f.visa && !t.easyVisa) return false;
  return true;
}

const SORTS: Record<string, (from: string) => (a: TripDTO, b: TripDTO) => number> = {
  rec: (from) => (a, b) => (b.rating * 1000 - ppPrice(b, from) / 400 + (b.featured ? 300 : 0)) - (a.rating * 1000 - ppPrice(a, from) / 400 + (a.featured ? 300 : 0)),
  price: (from) => (a, b) => ppPrice(a, from) - ppPrice(b, from),
  rating: () => (a, b) => b.rating - a.rating,
  deal: () => (a, b) => savingPct(b) - savingPct(a),
  nights: () => (a, b) => a.nights - b.nights,
};

export default function TripExplorer({ trips, initial }: { trips: TripDTO[]; initial: Filters }) {
  const path = usePathname();
  const { from, currency } = usePrefs();
  const [f, setF] = useState<Filters>(initial);

  // Keep the address bar in sync so filtered views can be shared.
  // replaceState updates the URL without a server round trip.
  useEffect(() => {
    const qs = toQuery(f);
    window.history.replaceState(null, "", qs ? `${path}?${qs}` : path);
  }, [f, path]);

  const upd = (p: Partial<Filters>) => setF((cur) => ({ ...cur, ...p }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const list = useMemo(() => trips.filter((t) => matches(t, f, from)).sort((SORTS[f.sort] ?? SORTS.rec)(from)), [trips, f, from]);
  const regions = [...new Set(trips.map((t) => t.region))];
  const boards = Object.keys(BOARDS).filter((b) => trips.some((t) => t.board === b));

  const chips: [string, () => void][] = [];
  if (f.kind) chips.push([KINDS[f.kind] ?? f.kind, () => upd({ kind: "" })]);
  if (f.q) chips.push([`“${f.q}”`, () => upd({ q: "" })]);
  if (f.theme) chips.push([THEMES.find((t) => t.key === f.theme)?.label ?? f.theme, () => upd({ theme: "" })]);
  if (f.deal) chips.push([f.deal === "lm" ? "Last minute" : "Early bird", () => upd({ deal: "" })]);
  if (f.nights) chips.push([`${f.nights.replace("-", "–")} nights`, () => upd({ nights: "" })]);
  if (f.date) chips.push([`Around ${new Date(f.date + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, () => upd({ date: "", flex: "" })]);
  f.regions.forEach((r) => chips.push([r, () => upd({ regions: f.regions.filter((x) => x !== r) })]));

  const reset = () => setF(parseFilters({}));

  return (
    <div className="results">
      <aside className="filters" aria-label="Filters">
        <div>
          <h4>Search</h4>
          <input className="in" placeholder="Destination or country" value={f.q} onChange={(e) => upd({ q: e.target.value })} aria-label="Search destination" />
        </div>
        <div>
          <h4>Trip type</h4>
          <div className="chips">
            <button aria-pressed={!f.kind} onClick={() => upd({ kind: "" })}>All</button>
            {Object.entries(KINDS).map(([k, l]) => <button key={k} aria-pressed={f.kind === k} onClick={() => upd({ kind: f.kind === k ? "" : k })}>{l}</button>)}
          </div>
        </div>
        <div>
          <h4>Budget per person</h4>
          <input type="range" min={20000} max={MAX_BUDGET} step={5000} value={f.budget} onChange={(e) => upd({ budget: Number(e.target.value) })} aria-label="Maximum price per person" />
          <div className="mono" style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}><span>up to</span><span>{fmt(f.budget, currency)}</span></div>
        </div>
        <div>
          <h4>Region</h4>
          {regions.map((r) => (
            <label className="chk" key={r}><input type="checkbox" checked={f.regions.includes(r)} onChange={() => upd({ regions: toggle(f.regions, r) })} /> {r}
              <span className="ct">{trips.filter((t) => t.region === r && matches(t, f, from, "region")).length}</span></label>
          ))}
        </div>
        <div>
          <h4>Hotel stars</h4>
          <div className="chips">{[3, 4, 5].map((s) => <button key={s} aria-pressed={f.stars.includes(s)} onClick={() => upd({ stars: toggle(f.stars, s) })}>{s}★</button>)}</div>
        </div>
        <div>
          <h4>Meal plan</h4>
          {boards.map((b) => (
            <label className="chk" key={b}><input type="checkbox" checked={f.boards.includes(b)} onChange={() => upd({ boards: toggle(f.boards, b) })} /> {BOARDS[b]}
              <span className="ct">{trips.filter((t) => t.board === b && matches(t, f, from, "board")).length}</span></label>
          ))}
        </div>
        <div>
          <h4>Must have</h4>
          <label className="chk"><input type="checkbox" checked={f.free} onChange={(e) => upd({ free: e.target.checked })} /> Free cancellation</label>
          <label className="chk"><input type="checkbox" checked={f.flight} onChange={(e) => upd({ flight: e.target.checked })} /> Flights included</label>
          <label className="chk"><input type="checkbox" checked={f.beach} onChange={(e) => upd({ beach: e.target.checked })} /> Beach within 300 m</label>
          <label className="chk"><input type="checkbox" checked={f.tm} onChange={(e) => upd({ tm: e.target.checked })} /> Tour manager on trip</label>
          <label className="chk"><input type="checkbox" checked={f.visa} onChange={(e) => upd({ visa: e.target.checked })} /> Visa on arrival / e-visa</label>
        </div>
        <button className="btn" onClick={reset}>Clear all filters</button>
      </aside>

      <div style={{ minWidth: 0 }}>
        <div className="toolbar">
          <div>
            <strong>{list.length} {list.length === 1 ? "trip" : "trips"} from {from}</strong>
            <div className="active-chips">{chips.map(([l, fn]) => <button key={l} onClick={fn} aria-label={`Remove ${l}`}>{l} ✕</button>)}</div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 600 }}>Sort
            <select value={f.sort} onChange={(e) => upd({ sort: e.target.value })}>
              <option value="rec">Recommended</option>
              <option value="price">Lowest price</option>
              <option value="rating">Guest rating</option>
              <option value="deal">Biggest saving</option>
              <option value="nights">Shortest trip</option>
            </select>
          </label>
        </div>
        {list.length ? (
          <div className="grid">{list.map((t) => <TripCard key={t.id} t={t} />)}</div>
        ) : (
          <div className="empty"><h3 style={{ marginBottom: 8 }}>No trips match all of these</h3>Remove a filter or raise your budget to see more.<br /><br /><button className="btn primary" onClick={reset}>Clear all filters</button></div>
        )}
      </div>
    </div>
  );
}
