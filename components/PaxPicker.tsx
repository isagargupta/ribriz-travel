"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "./Prefs";

/** Travellers field with an adults/children popover; stored in shared prefs. */
export default function PaxPicker({ className = "field" }: { className?: string }) {
  const { adults, childAges, set } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const c = childAges.length;
  const label = `${adults} adult${adults > 1 ? "s" : ""}${c ? `, ${c} child${c > 1 ? "ren" : ""}` : ""}`;

  return (
    <div className={className} ref={ref}>
      <span className="lbl">Travellers</span>
      <button type="button" className="pick" aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <div className="pax-pop">
          <div className="pax-row">
            <div>Adults<small>12+ years</small></div>
            <div className="stepper">
              <button type="button" aria-label="Fewer adults" onClick={() => set({ adults: Math.max(1, adults - 1) })}>−</button>
              <span className="mono">{adults}</span>
              <button type="button" aria-label="More adults" onClick={() => set({ adults: Math.min(9, adults + 1) })}>+</button>
            </div>
          </div>
          <div className="pax-row">
            <div>Children<small>0–11 years, age on return</small></div>
            <div className="stepper">
              <button type="button" aria-label="Fewer children" onClick={() => set({ childAges: childAges.slice(0, -1) })}>−</button>
              <span className="mono">{c}</span>
              <button type="button" aria-label="More children" onClick={() => c < 6 && set({ childAges: [...childAges, 6] })}>+</button>
            </div>
          </div>
          {c > 0 && (
            <div className="child-ages">
              {childAges.map((a, i) => (
                <label key={i} style={{ fontSize: 12, color: "var(--muted)" }}>Child {i + 1}<br />
                  <select value={a} aria-label={`Age of child ${i + 1}`} onChange={(e) => {
                    const next = [...childAges]; next[i] = Number(e.target.value); set({ childAges: next });
                  }}>
                    {Array.from({ length: 12 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                  </select>
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
