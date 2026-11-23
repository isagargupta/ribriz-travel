"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_ADULTS, MAX_CHILDREN, childBand } from "@/lib/pricing";
import { usePrefs } from "./Prefs";

/** Travellers field with an adults/children popover; stored in shared prefs. */
export default function PaxPicker({ className = "field" }: { className?: string }) {
  const { adults, childAges, set } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc, true); };
  }, [open]);

  const c = childAges.length;
  const label = `${adults} adult${adults > 1 ? "s" : ""}${c ? `, ${c} child${c > 1 ? "ren" : ""}` : ""}`;

  return (
    <div className={className} ref={ref}>
      <span className="lbl">Travellers</span>
      <button type="button" className="pick" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {label}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 6, transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="pax-pop pop-in" role="dialog" aria-label="Travellers">
          <div className="pax-row">
            <div>Adults<small>12+ years</small></div>
            <div className="stepper">
              <button type="button" aria-label="Fewer adults" disabled={adults <= 1} onClick={() => set({ adults: adults - 1 })}>−</button>
              <span className="mono" aria-live="polite">{adults}</span>
              <button type="button" aria-label="More adults" disabled={adults >= MAX_ADULTS} onClick={() => set({ adults: adults + 1 })}>+</button>
            </div>
          </div>
          <div className="pax-row">
            <div>Children<small>0–11 years on return</small></div>
            <div className="stepper">
              <button type="button" aria-label="Fewer children" disabled={c === 0} onClick={() => set({ childAges: childAges.slice(0, -1) })}>−</button>
              <span className="mono" aria-live="polite">{c}</span>
              <button type="button" aria-label="More children" disabled={c >= MAX_CHILDREN} onClick={() => set({ childAges: [...childAges, 6] })}>+</button>
            </div>
          </div>
          {c > 0 && (
            <div className="child-ages">
              {childAges.map((a, i) => (
                <label key={i}>Child {i + 1}
                  <select value={a} aria-label={`Age of child ${i + 1}`} onChange={(e) => { const next = [...childAges]; next[i] = Number(e.target.value); set({ childAges: next }); }}>
                    {Array.from({ length: 12 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Under 1" : `${n} yr`}</option>)}
                  </select>
                  <small>{childBand(a)} of adult price</small>
                </label>
              ))}
            </div>
          )}
          <button type="button" className="btn primary" onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
