"use client";
import { useEffect, useRef, useState } from "react";

/** A number that glides to its new value (prices updating as you change travellers). */
export function useTween(value: number, ms = 450) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    if (a === b || matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(b); from.current = b; return; }
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (b - a) * e));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return v;
}
