"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePrefs } from "../Prefs";
import { askRiya } from "../assistant/Assistant";
import type { VisaDestination } from "@/lib/visa-service";
import type { VisaKind } from "@/lib/visa-service-rules";

const FILTERS: { key: "all" | VisaKind | "fast"; label: string }[] = [
  { key: "all", label: "All" }, { key: "evisa", label: "e-Visa" }, { key: "sticker", label: "Embassy visa" }, { key: "visa_free", label: "Visa-free + arrival card" }, { key: "fast", label: "Ready in 3 days" },
];
const by = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Search box and destination cards. Cards show the visa type, stay, fee and the
 * date the visa should be ready if you apply now. Countries we don't list yet
 * go to Riya, who hands them to the visa team.
 */
export default function VisaFinder({ dests, others }: { dests: VisaDestination[]; others: { code: string; name: string; rule: string }[] }) {
  const { money } = usePrefs();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState(false);

  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "");
  const hits = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return { ours: [], theirs: [] };
    const ours = dests.filter((d) => norm(d.country).includes(n) || d.destSlug.includes(n.replace(/ /g, "-")) || norm(d.products.map((p) => p.name).join(" ")).includes(n)).slice(0, 6);
    const theirs = others.filter((o) => norm(o.name).startsWith(n) && !ours.some((d) => d.countryCode === o.code)).slice(0, 4);
    return { ours, theirs };
  }, [q, dests, others]);

  const list = dests.filter((d) => f === "all" ? true : f === "fast" ? d.fastest <= 3 && d.from > 0 : d.kinds.includes(f as VisaKind)).sort((a, b) => Number(b.popular) - Number(a.popular));

  return (
    <>
      <div className="vz-search" onFocus={() => setOpen(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
        <div className="vz-pass" title="We apply for Indian passport holders"><span aria-hidden="true">🇮🇳</span><small>Passport</small><b>India</b></div>
        <label className="vz-to">
          <small>Travelling to</small>
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder="Search a country, e.g. Japan, Dubai, France" aria-label="Search a destination" autoComplete="off" />
        </label>
        {open && (hits.ours.length > 0 || hits.theirs.length > 0) && (
          <ul className="vz-results" role="listbox">
            {hits.ours.map((d) => (
              <li key={d.destSlug}><Link href={`/visa/${d.destSlug}`} role="option" aria-selected="false">
                <span className="vz-flag">{d.flag}</span><span><b>{d.country}</b><small>{d.products.map((p) => p.kindLabel).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}{d.from ? ` · from ${money(d.from)}` : " · nothing to apply for"}</small></span><span className="vz-go">→</span>
              </Link></li>
            ))}
            {hits.theirs.map((o) => (
              <li key={o.code}><button type="button" onClick={() => askRiya(`I need a visa for ${o.name}. Can your team help?`)}>
                <span className="vz-flag">🌍</span><span><b>{o.name}</b><small>{o.rule} · our visa team can help</small></span><span className="vz-go">Ask →</span>
              </button></li>
            ))}
          </ul>
        )}
        {open && q.trim().length > 1 && !hits.ours.length && !hits.theirs.length && (
          <ul className="vz-results"><li><button type="button" onClick={() => askRiya(`I need a visa for ${q.trim()}. Can your team help?`)}><span className="vz-flag">💬</span><span><b>Ask our visa team about “{q.trim()}”</b><small>Riya passes it to an expert</small></span></button></li></ul>
        )}
      </div>

      <div className="vz-filters" role="tablist" aria-label="Filter visas">
        {FILTERS.map((x) => <button key={x.key} role="tab" aria-selected={f === x.key} className={f === x.key ? "on" : ""} onClick={() => setF(x.key)}>{x.label}</button>)}
      </div>

      <div className="vz-grid">
        {list.map((d, i) => {
          const p = d.products.filter((x) => x.canApply).sort((a, b) => a.perPerson - b.perPerson)[0] ?? d.products[0];
          return (
            <Link key={d.destSlug} href={`/visa/${d.destSlug}`} className="vz-card" style={{ ["--i" as string]: i }}>
              <div className="vz-card-top" style={d.image ? { backgroundImage: `linear-gradient(180deg, rgba(11,18,64,.05), rgba(11,18,64,.7)), url(${d.image})` } : undefined}>
                <span className="vz-flag lg">{d.flag}</span>
                <b>{d.country}</b>
                {d.popular && <span className="vz-pop">Popular</span>}
              </div>
              <dl className="vz-facts">
                <div><dt>Type</dt><dd>{p.kindLabel}</dd></div>
                <div><dt>Stay</dt><dd>{p.stayDays ? `${p.stayDays} days` : "–"}</dd></div>
                <div><dt>Fee</dt><dd>{p.canApply ? money(p.perPerson) : "Free"}</dd></div>
              </dl>
              <div className="vz-by">{p.canApply ? <>Visa by <b>{by(p.readyBy)}</b>{p.needsAppointment ? " · plus appointment" : ""}</> : "Nothing to apply for"}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
