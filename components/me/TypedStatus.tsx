"use client";
import { useEffect, useState } from "react";

/** Riya "speaks" her status: each line types out, pauses, and the next follows. */
export default function TypedStatus({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const line = lines[i % lines.length] ?? "";
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(line.length); return; }
    if (n < line.length) { const t = setTimeout(() => setN(n + 1), 28 + Math.random() * 30); return () => clearTimeout(t); }
    if (lines.length < 2) return;
    const t = setTimeout(() => { setI(i + 1); setN(0); }, 2600);
    return () => clearTimeout(t);
  }, [n, line, i, lines.length]);
  return (
    <p className="typed" aria-live="polite">
      <span className="typed-who">Riya</span>
      <span className="typed-text">{line.slice(0, n)}<span className="caret" aria-hidden="true" /></span>
      <span className="sr-only">{lines.join(". ")}</span>
    </p>
  );
}
