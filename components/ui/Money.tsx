"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../Prefs";

/** Shows an INR amount in the visitor's currency and glides between values when it changes. */
export default function Money({ inr, className }: { inr: number; className?: string }) {
  const { money } = usePrefs();
  const [shown, setShown] = useState(inr);
  const from = useRef(inr);
  const raf = useRef(0);

  useEffect(() => {
    const start = from.current, end = inr;
    if (start === end) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(end); from.current = end; return; }
    const t0 = performance.now(), dur = 420;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (end - start) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [inr]);

  return <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{money(shown)}</span>;
}
