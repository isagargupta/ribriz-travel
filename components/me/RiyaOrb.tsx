"use client";
import { useEffect, useRef } from "react";
import { askRiya } from "../assistant/Assistant";

/**
 * Riya, alive: a morphing gradient core with orbiting sparks and rings. Her
 * eyes follow the pointer and blink. "attention" turns her coral and bouncy
 * when something needs the traveller. Tap to talk.
 */
export default function RiyaOrb({ mood = "idle", size = 220 }: { mood?: "idle" | "working" | "attention"; size?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty("--lx", `${Math.max(-1, Math.min(1, dx * 3)) * 9}px`);
        el.style.setProperty("--ly", `${Math.max(-1, Math.min(1, dy * 3)) * 6}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <button ref={ref} type="button" className={`orb orb-${mood}`} style={{ ["--s" as string]: `${size}px` }} onClick={() => askRiya()} aria-label="Talk to Riya, your travel agent">
      <span className="orb-glow" aria-hidden="true" />
      <span className="orb-ring r1" aria-hidden="true" />
      <span className="orb-ring r2" aria-hidden="true" />
      <span className="orb-orbit o1" aria-hidden="true"><i /></span>
      <span className="orb-orbit o2" aria-hidden="true"><i /></span>
      <span className="orb-orbit o3" aria-hidden="true"><i /></span>
      <span className="orb-core" aria-hidden="true">
        <span className="orb-shine" />
        <span className="orb-eyes"><i /><i /></span>
      </span>
      <span className="orb-sparks" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
    </button>
  );
}
