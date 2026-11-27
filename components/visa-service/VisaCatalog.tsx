"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePrefs } from "../Prefs";
import { Flag, Icon, fmtDay } from "./ui";
import type { DestCard } from "./types";

const REGIONS = ["All", "Asia", "Middle East", "Europe", "Africa", "Americas", "Oceania"];
const SORTS = { popular: "Most popular", fastest: "Fastest", cheapest: "Lowest fee", az: "A to Z" } as const;
const TYPES = { all: "All visa types", evisa: "e-Visa & ETA", sticker: "Embassy visa", free: "No visa needed" } as const;

function Card({ d, i }: { d: DestCard; i: number }) {
  const { money } = usePrefs();
  return (
    <Link href={`/visa/${d.slug}`} className="vx-card" style={{ ["--i" as string]: i }}>
      <div className="vx-card-top">
        <Flag code={d.code} size={44} />
        <div><b>{d.country}</b><small>{d.region}</small></div>
      </div>
      <div className="vx-badges">
        <span className={`vx-badge ${d.kind}`}>{d.kindLabel}</span>
        {d.popular && <span className="vx-badge pop">★ Popular</span>}
      </div>
      <div className="vx-card-facts">
        <div><small>{d.canApply ? "Processing" : "Stay"}</small><strong>{d.canApply ? (d.days ? `${d.days} working days` : "1 day") : d.stay ? `${d.stay} days` : "Varies"}</strong></div>
        <div><small>{d.canApply ? (d.serviceOnly ? "Our fee from" : "All-in fee") : "Cost"}</small><strong>{d.canApply ? `${money(d.from)}${d.serviceOnly ? "+" : ""}` : "Free"}</strong></div>
      </div>
      <div className={`vx-card-foot ${d.canApply ? "" : "muted"}`}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{d.canApply ? <><Icon name="calendar" size={16} /> Get it by {fmtDay(d.readyBy)}</> : "See entry rules"}</span>
        <span className="vx-arrow"><Icon name="arrow" size={15} /></span>
      </div>
    </Link>
  );
}

/** Every destination: region tabs, visa type and sort, a growing card grid, and an A–Z list. */
export default function VisaCatalog({ dests }: { dests: DestCard[] }) {
  const [region, setRegion] = useState("All");
  const [type, setType] = useState<keyof typeof TYPES>("all");
  const [sort, setSort] = useState<keyof typeof SORTS>("popular");
  const [shown, setShown] = useState(16);

  const counts = useMemo(() => Object.fromEntries(REGIONS.map((r) => [r, r === "All" ? dests.length : dests.filter((d) => d.region === r).length])), [dests]);
  const list = useMemo(() => {
    const l = dests.filter((d) => (region === "All" || d.region === region) && (type === "all" || (type === "evisa" ? d.kind === "evisa" || d.kind === "eta" : type === "sticker" ? d.kind === "sticker" : !d.canApply)));
    const by: Record<keyof typeof SORTS, (a: DestCard, b: DestCard) => number> = {
      popular: (a, b) => Number(b.popular) - Number(a.popular) || Number(b.curated) - Number(a.curated) || a.country.localeCompare(b.country),
      fastest: (a, b) => Number(b.canApply) - Number(a.canApply) || a.days - b.days,
      cheapest: (a, b) => Number(b.canApply) - Number(a.canApply) || a.from - b.from,
      az: (a, b) => a.country.localeCompare(b.country),
    };
    return l.sort(by[sort]);
  }, [dests, region, type, sort]);

  const az = useMemo(() => {
    const g = new Map<string, DestCard[]>();
    for (const d of [...dests].sort((a, b) => a.country.localeCompare(b.country))) g.set(d.country[0], [...(g.get(d.country[0]) ?? []), d]);
    return [...g.entries()];
  }, [dests]);

  return (
    <>
      <div className="vx-toolbar">
        <div className="vx-tabs" role="tablist" aria-label="Region">
          {REGIONS.map((r) => <button key={r} role="tab" aria-selected={region === r} onClick={() => { setRegion(r); setShown(16); }}>{r}<span>{counts[r]}</span></button>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="vx-select" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)} aria-label="Visa type">{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="vx-select" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Sort">{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
      </div>
      <div className="vx-cards" key={region + type + sort}>{list.slice(0, shown).map((d, i) => <Card key={d.slug} d={d} i={i} />)}</div>
      {list.length === 0 && <p style={{ color: "var(--mute)" }}>Nothing matches these filters.</p>}
      {list.length > shown && <div className="vx-more"><button className="vx-btn" onClick={() => setShown(shown + 24)}>Show more destinations ({list.length - shown})</button></div>}

      <div id="all-countries" style={{ marginTop: 56 }}>
        <div className="vx-sec-head"><div><h2>All {dests.length} countries</h2><p>Every destination, with what Indian passport holders need.</p></div></div>
        <div className="vx-az">
          {az.map(([letter, ds]) => (
            <div key={letter} className="vx-az-group">
              <h3>{letter}</h3>
              {ds.map((d) => <Link key={d.slug} href={`/visa/${d.slug}`}><Flag code={d.code} size={20} /><span>{d.country}</span><i>{d.kindLabel}</i></Link>)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
