"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { VISA_META, countryName, flag, visaLine, type VisaCategory, type VisaRuleDTO } from "@/lib/visa";
import { searchItems } from "@/lib/search";
import { usePrefs } from "../Prefs";
import PassportSelect from "./PassportSelect";
import { useVisaRules } from "./useVisaRules";

type TripLink = { slug: string; title: string };
const TABS: VisaCategory[] = ["visa_free", "voa", "eta", "evisa", "required"];

interface Props {
  passports: string[];
  initial: { passport: string; rules: VisaRuleDTO[] };
  trips: Record<string, TripLink[]>;
  sourceDate: string | null;
  initialDest?: string;
}

export default function VisaChecker({ passports, initial, trips, sourceDate, initialDest }: Props) {
  const { passport, ready } = usePrefs();
  const pp = ready ? passport : initial.passport;
  const rules = useVisaRules(pp, initial);
  const [dest, setDest] = useState<string | null>(initialDest ?? null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<VisaCategory>("visa_free");
  const result = useRef<HTMLDivElement>(null);

  const list = useMemo(() => (rules ?? []).filter((r) => r.c !== "own").map((r) => ({ ...r, name: countryName(r.d) })), [rules]);
  const byCat = useMemo(() => {
    const m = new Map<VisaCategory, typeof list>();
    for (const r of list) m.set(r.c, [...(m.get(r.c) ?? []), r]);
    for (const v of m.values()) v.sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || a.name.localeCompare(b.name));
    return m;
  }, [list]);
  const suggestions = useMemo(() => (q.trim() ? searchItems(q, list, (r) => [{ text: r.name, weight: 3 }, { text: r.d, weight: 1 }], 8) : []), [q, list]);
  const picked = dest ? list.find((r) => r.d === dest) : null;

  // keep the chosen country in the address so it can be shared
  useEffect(() => {
    const url = new URL(window.location.href);
    if (dest) url.searchParams.set("to", dest); else url.searchParams.delete("to");
    window.history.replaceState(window.history.state, "", url);
  }, [dest]);

  const choose = (code: string) => {
    setDest(code); setQ(""); setOpen(false);
    setTimeout(() => result.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  return (
    <div className="visa">
      <div className="panel visa-search">
        <PassportSelect passports={passports} />
        <div className="lab visa-dest">
          <label htmlFor="visa-dest">Where are you going?</label>
          <div className="search-in">
            <input id="visa-dest" className="in" placeholder="Type a country, e.g. Thailand" value={q} autoComplete="off"
              role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls="visa-sugg"
              onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); choose(suggestions[0].d); } if (e.key === "Escape") setOpen(false); }} />
            {open && suggestions.length > 0 && (
              <ul className="visa-sugg pop-in" id="visa-sugg" role="listbox">
                {suggestions.map((s) => (
                  <li key={s.d}><button role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s.d)}>
                    <span className="fl">{flag(s.d)}</span><span>{s.name}</span><span className={`vt ${VISA_META[s.c].tone}`}>{VISA_META[s.c].short}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div ref={result}>
        {picked && (
          <div className={`visa-result tone-${VISA_META[picked.c].tone} pop-in`} key={pp + picked.d}>
            <div className="vr-head">
              <span className="vr-flag" aria-hidden="true">{flag(picked.d)}</span>
              <div>
                <small>{flag(pp)} {countryName(pp)} passport → {picked.name}</small>
                <h2>{visaLine(picked)}</h2>
              </div>
              <button className="icon-btn" onClick={() => setDest(null)} aria-label="Clear">×</button>
            </div>
            <p>{VISA_META[picked.c].blurb}</p>
            {(trips[picked.d]?.length ?? 0) > 0 && (
              <div className="vr-trips"><b>Our trips to {picked.name}:</b> {trips[picked.d].map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link href={`/trips/${t.slug}`}>{t.title}</Link></span>)}</div>
            )}
            <div className="vr-actions">
              {(picked.c === "evisa" || picked.c === "required" || picked.c === "eta") && <Link className="btn hot sm" href={`/plan`}>Get help with this visa</Link>}
              <Link className="btn sm" href={`/trips?q=${encodeURIComponent(picked.name)}`}>Trips to {picked.name}</Link>
            </div>
          </div>
        )}
      </div>

      <div className="visa-tabs" role="tablist" aria-label="Visa type">
        {TABS.map((c) => (
          <button key={c} role="tab" aria-selected={tab === c} className={`vtab ${VISA_META[c].tone}`} onClick={() => setTab(c)}>
            <b>{rules ? byCat.get(c)?.length ?? 0 : "–"}</b><span>{VISA_META[c].label}</span>
          </button>
        ))}
      </div>
      <p className="muted visa-tab-blurb">{VISA_META[tab].blurb}</p>
      {!rules ? (
        <div className="visa-grid">{Array.from({ length: 12 }, (_, i) => <div key={i} className="visa-chip skel" style={{ minHeight: 44 }} />)}</div>
      ) : (byCat.get(tab)?.length ?? 0) === 0 ? (
        <div className="empty" style={{ padding: 24 }}>No countries in this group for a {countryName(pp)} passport.</div>
      ) : (
        <div className="visa-grid stagger" key={pp + tab}>
          {byCat.get(tab)!.map((r) => (
            <button key={r.d} className={`visa-chip ${dest === r.d ? "on" : ""}`} onClick={() => choose(r.d)}>
              <span className="fl">{flag(r.d)}</span><span className="nm">{r.name}</span>
              {r.days ? <span className="dy">{r.days}d</span> : trips[r.d] ? <span className="dy trip">trips</span> : null}
            </button>
          ))}
        </div>
      )}

      <p className="fine visa-note">
        Source: Passport Index dataset{sourceDate ? `, last updated ${new Date(sourceDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. Checked weekly.
        Visa rules change often and can depend on your purpose of travel or other visas you hold. Always confirm on the destination&apos;s official government website before you travel, or ask us.
      </p>
    </div>
  );
}
