"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { FROM_CITIES, isoDate } from "@/lib/pricing";
import PaxPicker from "../PaxPicker";

const TABS = [
  { k: "", label: "✦ All holidays" },
  { k: "package", label: "✈ Flight + hotel" },
  { k: "escorted", label: "⚑ Group tours" },
  { k: "hotel", label: "⌂ Hotel only" },
  { k: "cruise", label: "⚓ Cruises" },
];
const INDIA = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Ahmedabad"];

export default function SearchConsole({ destinations }: { destinations: string[] }) {
  const router = useRouter();
  const { from, set } = usePrefs();
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [flex, setFlex] = useState(3);
  const [nights, setNights] = useState("any");
  const today = useRef(isoDate(new Date()));

  useEffect(() => {
    const d = new Date(); d.setDate(d.getDate() + 10); setDate(isoDate(d));
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (q.trim()) p.set("q", q.trim());
    if (date) p.set("date", date);
    if (flex) p.set("flex", String(flex));
    if (nights !== "any") p.set("nights", nights);
    router.push(`/trips?${p.toString()}`);
  }

  return (
    <div className="wrap console-wrap">
      <div className="console">
        <div className="console-tabs" role="tablist" aria-label="Trip type">
          {TABS.map((t) => (
            <button key={t.k} role="tab" type="button" aria-selected={kind === t.k} onClick={() => setKind(t.k)}>{t.label}</button>
          ))}
        </div>
        <form onSubmit={submit} autoComplete="off">
          <div className="field">
            <label htmlFor="from">Flying from</label>
            <select id="from" value={from} onChange={(e) => set({ from: e.target.value })}>
              <optgroup label="India">{INDIA.map((c) => <option key={c}>{c}</option>)}</optgroup>
              <optgroup label="Europe">{Object.keys(FROM_CITIES).filter((c) => !INDIA.includes(c)).map((c) => <option key={c}>{c}</option>)}</optgroup>
            </select>
          </div>
          <div className="field">
            <label htmlFor="dest">Where to</label>
            <input id="dest" list="destList" placeholder="Anywhere · Bali, Kerala, Turkey…" value={q} onChange={(e) => setQ(e.target.value)} />
            <datalist id="destList">{destinations.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor="date">Departure</label>
            <input id="date" type="date" min={today.current} value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="chips" style={{ marginTop: 4 }} aria-label="Date flexibility">
              {[0, 3, 7].map((f) => (
                <button key={f} type="button" aria-pressed={flex === f} onClick={() => setFlex(f)} style={{ fontSize: 11, padding: "1px 8px" }}>{f ? `±${f} days` : "Exact"}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="nights">Nights</label>
            <select id="nights" value={nights} onChange={(e) => setNights(e.target.value)}>
              <option value="any">Any length</option>
              <option value="3-5">3 – 5</option>
              <option value="6-8">6 – 8</option>
              <option value="9-12">9 – 12</option>
              <option value="13-30">13+</option>
            </select>
          </div>
          <PaxPicker />
          <button className="go" type="submit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            Search
          </button>
        </form>
        <div className="quick">Popular:
          {[["Bali", "Bali"], ["Maldives", "Maldives"], ["Kashmir", "Kashmir"], ["Turkey", "Antalya"], ["Europe tour", "Europe"], ["Dubai", "Dubai"]].map(([l, v]) => (
            <Link key={v} href={`/trips?q=${encodeURIComponent(v)}`}>{l}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
