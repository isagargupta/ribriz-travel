"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { askRiya } from "../assistant/Assistant";
import { Flag, Icon, fmtDay } from "./ui";
import type { DestCard } from "./types";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "");
const ALIASES: Record<string, string[]> = { "dubai-uae": ["dubai", "uae", "emirates", "abu dhabi"], dubai: ["dubai", "uae", "emirates", "abu dhabi"], "united-kingdom": ["uk", "britain", "england", "london"], "united-states": ["usa", "us", "america"], france: ["schengen", "paris", "europe"], indonesia: ["bali"], turkiye: ["turkey", "istanbul"] };

function highlight(text: string, q: string) {
  const i = norm(text).indexOf(norm(q));
  if (!q || i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/** The hero search: passport (India) + destination, with a keyboard-friendly suggestion list. */
export default function VisaSearch({ dests, quick }: { dests: DestCard[]; quick: DestCard[] }) {
  const router = useRouter();
  const { money } = usePrefs();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const hits = useMemo(() => {
    const n = norm(q.trim());
    const pool = n ? dests.filter((d) => norm(d.country).includes(n) || (ALIASES[d.slug] ?? []).some((a) => a.startsWith(n))) : dests.filter((d) => d.popular);
    return pool.sort((a, b) => Number(norm(b.country).startsWith(n)) - Number(norm(a.country).startsWith(n)) || Number(b.curated) - Number(a.curated)).slice(0, 7);
  }, [q, dests]);

  const go = (d?: DestCard) => {
    if (d) router.push(`/visa/${d.slug}`);
    else if (q.trim()) askRiya(`I need a visa for ${q.trim()}. Can your team help?`);
    else input.current?.focus();
  };

  return (
    <>
      <form className="vx-search vx-reveal d2" role="search" onSubmit={(e) => { e.preventDefault(); go(hits[hi]); }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
        <div className="vx-sfield" title="We currently apply for Indian passport holders">
          <Flag code="in" size={30} />
          <div><span className="vx-slabel">Passport</span><b>India</b></div>
        </div>
        <div className="vx-sfield">
          <Icon name="globe" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor={id}>Travelling to</label>
            <input
              id={id} ref={input} value={q} placeholder="Where are you going?" autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-list`}
              aria-activedescendant={open && hits[hi] ? `${id}-${hi}` : undefined}
              onFocus={() => setOpen(true)}
              onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(hits.length - 1, h + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
                else if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
        </div>
        <button className="vx-sbtn" type="submit">Check visa <Icon name="arrow" size={18} /></button>

        {open && (
          <div className="vx-pop" id={`${id}-list`} role="listbox" aria-label="Destinations">
            {hits.map((d, i) => (
              <Link key={d.slug} id={`${id}-${i}`} href={`/visa/${d.slug}`} role="option" aria-selected={i === hi} className="vx-opt" onMouseEnter={() => setHi(i)}>
                <Flag code={d.code} size={34} />
                <span><b>{highlight(d.country, q.trim())}</b><small>{d.kindLabel}{d.stay ? ` · ${d.stay}-day stay` : ""}</small></span>
                <span className="vx-opt-meta">{d.canApply ? <><strong>{money(d.from)}{d.serviceOnly ? "+" : ""}</strong>by {fmtDay(d.readyBy)}</> : <strong style={{ color: "var(--ok)" }}>No visa needed ahead</strong>}</span>
              </Link>
            ))}
            {!hits.length && (
              <button type="button" className="vx-opt" onClick={() => go()}>
                <span className="vx-ico"><Icon name="chat" /></span>
                <span><b>Ask our visa team about “{q.trim()}”</b><small>Riya passes it to a visa expert</small></span><span />
              </button>
            )}
            <div className="vx-pop-foot">{q ? "↑ ↓ to move · Enter to open" : "Popular right now · type any country"}</div>
          </div>
        )}
      </form>
      <div className="vx-quick vx-reveal d3">
        <span>Popular:</span>
        {quick.map((d) => <Link key={d.slug} href={`/visa/${d.slug}`}><Flag code={d.code} size={20} />{d.country}</Link>)}
      </div>
    </>
  );
}
