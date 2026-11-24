"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { fmtDate } from "@/lib/pricing";
import type { AskQuestion, Step, TripPick, UiBlock } from "@/lib/assistant/ui";
import { usePrefs } from "../Prefs";

/* ---------------- Riya's work, live ---------------- */

/** Each tool Riya runs appears as a step that ticks off; when she's done it folds into one line. */
export function WorkTrail({ steps, working }: { steps: Step[]; working: boolean }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const done = steps.filter((s) => s.state !== "run").length;
  if (!working && !open) {
    return (
      <button type="button" className="trail-fold" onClick={() => setOpen(true)}>
        <span className="trail-ok" aria-hidden="true">✓</span> Riya did {steps.length} thing{steps.length > 1 ? "s" : ""} <span className="muted">· see how</span>
      </button>
    );
  }
  return (
    <ol className={`trail ${working ? "live" : ""}`} aria-label="What Riya is doing">
      {steps.map((s) => (
        <li key={s.id} className={`trail-${s.state}`}>
          <span className="trail-ico" aria-hidden="true">{s.state === "run" ? <i className="trail-spin" /> : s.state === "done" ? "✓" : "!"}</span>
          <span>{s.label}{s.detail && <small> · {s.detail}</small>}</span>
        </li>
      ))}
      {working && done === steps.length && <li className="trail-run"><span className="trail-ico"><i className="trail-spin" /></span><span>Putting it together…</span></li>}
      {!working && <li><button type="button" className="link-btn" onClick={() => setOpen(false)}>Hide steps</button></li>}
    </ol>
  );
}

/* ---------------- questions as taps ---------------- */

function compose(qs: AskQuestion[], a: Record<string, string[]>) {
  return qs.map((q) => (a[q.id]?.length ? `${q.label.replace(/\?$/, "")}: ${a[q.id].join(", ")}` : null)).filter(Boolean).join("\n");
}

export function AskForm({ block, locked, onSubmit }: { block: Extract<UiBlock, { kind: "ask" }>; locked: boolean; onSubmit: (text: string) => void }) {
  const [a, setA] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const qs = block.questions;
  const instant = qs.length === 1 && qs[0].type === "single";
  const ready = qs.every((q) => q.type === "text" || (a[q.id]?.length ?? 0) > 0);
  const done = locked || sent;

  const pick = (q: AskQuestion, label: string) => {
    if (done) return;
    if (instant) { setA({ [q.id]: [label] }); setSent(true); onSubmit(label); return; }
    setA((cur) => {
      const has = cur[q.id] ?? [];
      const next = q.type === "multi" ? (has.includes(label) ? has.filter((x) => x !== label) : [...has, label]) : [label];
      return { ...cur, [q.id]: next };
    });
  };
  const submit = () => {
    const merged = { ...a };
    for (const q of qs) if (other[q.id]?.trim()) merged[q.id] = q.type === "multi" ? [...(merged[q.id] ?? []), other[q.id].trim()] : [other[q.id].trim()];
    setSent(true);
    onSubmit(compose(qs, merged));
  };

  return (
    <div className={`ask ${done ? "done" : ""}`}>
      {block.intro && <p className="ask-intro">{block.intro}</p>}
      {qs.map((q, qi) => (
        <fieldset key={q.id} className="ask-q" style={{ ["--i" as string]: qi }} disabled={done}>
          <legend>{q.label}</legend>
          {q.type === "text" ? (
            <input className="ask-text" placeholder={q.placeholder ?? "Type here"} value={other[q.id] ?? ""} onChange={(e) => { setOther({ ...other, [q.id]: e.target.value }); setA({ ...a, [q.id]: e.target.value ? [e.target.value] : [] }); }} />
          ) : (
            <div className="ask-opts">
              {(q.options ?? []).map((o, oi) => (
                <button key={o.label} type="button" className="ask-opt" style={{ ["--j" as string]: oi }} aria-pressed={a[q.id]?.includes(o.label) ?? false} onClick={() => pick(q, o.label)}>
                  {o.emoji && <span aria-hidden="true">{o.emoji}</span>}{o.label}
                </button>
              ))}
              {!instant && !done && (
                <input className="ask-other" placeholder="Other…" value={other[q.id] ?? ""} onChange={(e) => setOther({ ...other, [q.id]: e.target.value })} aria-label={`${q.label}: something else`} />
              )}
            </div>
          )}
        </fieldset>
      ))}
      {!instant && !done && <button type="button" className="btn hot ask-go" disabled={!ready && !Object.values(other).some((v) => v.trim())} onClick={submit}>{block.submit} →</button>}
      {done && !instant && <p className="ask-sent">✓ Sent</p>}
    </div>
  );
}

/* ---------------- trips as a carousel ---------------- */

export function TripCarousel({ block, onSay, onNavigate }: { block: Extract<UiBlock, { kind: "trips" }>; onSay: (text: string) => void; onNavigate?: () => void }) {
  const { money } = usePrefs();
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * (rail.current.clientWidth * 0.8), behavior: "smooth" });
  const items: TripPick[] = block.items;
  return (
    <div className="carousel">
      {block.title && <div className="car-head"><b>{block.title}</b>{items.length > 1 && <span className="car-nav"><button type="button" onClick={() => scroll(-1)} aria-label="Previous">‹</button><button type="button" onClick={() => scroll(1)} aria-label="Next">›</button></span>}</div>}
      <div className="car-rail" ref={rail}>
        {items.map((t, i) => (
          <article key={t.slug + (t.date ?? "")} className={`car-card ${i === 0 && t.badge ? "lead" : ""}`} style={{ ["--i" as string]: i }}>
            <div className="car-img">
              <Image src={t.image} alt="" fill sizes="260px" />
              {t.badge && <span className="car-badge">{t.badge === "Riya's pick" ? "✦ " : ""}{t.badge}</span>}
              {t.rating ? <span className="car-rate">★ {t.rating.toFixed(1)}</span> : null}
            </div>
            <div className="car-body">
              <b>{t.dest}</b>
              <small>{t.nights} nights{t.date ? ` · ${fmtDate(t.date, { day: "numeric", month: "short" })}` : ""}{t.flight ? " · flights incl." : ""}</small>
              {t.why && <p className="car-why">{t.why}</p>}
              <div className="car-meta">
                <span className="car-price">{money(t.price)}<small>/adult</small></span>
                {t.visa && <span className="car-visa">{t.visa}</span>}
              </div>
              {t.seats !== null && t.seats <= 8 && <small className="warn-txt">Only {t.seats} seats left</small>}
              <div className="car-btns">
                <button type="button" className="btn hot sm" onClick={() => onSay(`Let's go with ${t.title}${t.date ? ` leaving ${fmtDate(t.date, { day: "numeric", month: "short", year: "numeric" })}` : ""}.`)}>Choose</button>
                <Link className="btn sm" href={`/trips/${t.slug}${t.date ? `?date=${t.date}` : ""}`} onClick={onNavigate}>Details</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------- next steps ---------------- */

export function ActionChips({ block, onSay, onNavigate }: { block: Extract<UiBlock, { kind: "actions" }>; onSay: (text: string) => void; onNavigate?: () => void }) {
  return (
    <div className="acts">
      {block.items.map((a, i) => a.href
        ? <Link key={a.label} className="act" style={{ ["--i" as string]: i }} href={a.href} onClick={onNavigate}>{a.icon && <span aria-hidden="true">{a.icon}</span>}{a.label}</Link>
        : <button key={a.label} type="button" className="act" style={{ ["--i" as string]: i }} onClick={() => onSay(a.say ?? a.label)}>{a.icon && <span aria-hidden="true">{a.icon}</span>}{a.label}</button>)}
    </div>
  );
}
