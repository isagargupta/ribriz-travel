"use client";
import { useId, useState } from "react";
import type { DashTask } from "@/lib/dashboard";

const ICON: Record<string, string> = { choose_trip: "🧭", price_hold: "🔒", visa: "🛂", insurance: "🛡️", forex: "💱", flights: "✈️", hotels: "🏨", prep: "🧳" };
const SHORT: Record<string, string> = { choose_trip: "Trip", price_hold: "Price", visa: "Visa", insurance: "Insurance", forex: "Forex", flights: "Flights", hotels: "Hotels", prep: "Checklist" };
const STATE: Record<string, string> = { done: "Done", skipped: "Not needed", in_progress: "Riya is on it", waiting: "With our team", needs_approval: "Needs your OK", todo: "Coming up" };

/**
 * A trip as a living map: the destination in the middle, each task Riya
 * handles orbiting it. Lines she's actively working on carry flowing sparks;
 * finished ones glow green; anything waiting for the traveller pulses coral.
 */
export default function Constellation({ tasks, image, label }: { tasks: DashTask[]; image: string | null; label: string }) {
  const uid = useId().replace(/[:]/g, "");
  const [hover, setHover] = useState<DashTask | null>(null);
  const W = 340, H = 250, cx = W / 2, cy = H / 2 - 6, rx = 128, ry = 86;
  const nodes = tasks.map((t, i) => {
    const a = -Math.PI / 2 + (i / tasks.length) * Math.PI * 2;
    return { t, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), i };
  });
  const active = (s: string) => s === "in_progress" || s === "waiting";
  const focus = hover ?? tasks.find((t) => t.status === "needs_approval") ?? tasks.find((t) => active(t.status)) ?? null;

  return (
    <figure className="cons" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${tasks.map((t) => `${SHORT[t.kind] ?? t.title} ${STATE[t.status] ?? t.status}`).join(", ")}`}>
        <defs>
          <clipPath id={`c-${uid}`}><circle cx={cx} cy={cy} r={34} /></clipPath>
          <radialGradient id={`g-${uid}`}><stop offset="0%" stopColor="#8b6cff" stopOpacity=".45" /><stop offset="100%" stopColor="#8b6cff" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="cons-orbit" />
        <circle cx={cx} cy={cy} r={62} fill={`url(#g-${uid})`} className="cons-halo" />
        {nodes.map(({ t, x, y, i }) => {
          const d = `M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}`;
          return (
            <g key={`e-${t.kind}`} className={`cons-edge s-${t.status}`} style={{ ["--d" as string]: `${i * 90}ms` }}>
              <path d={d} pathLength={1} className="base" />
              {active(t.status) && <path d={d} pathLength={1} className="flow" />}
              {active(t.status) && (
                <circle r={3.2} className="spark">
                  <animateMotion dur={`${1.6 + (i % 3) * 0.35}s`} repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
                </circle>
              )}
            </g>
          );
        })}
        <g className="cons-center">
          <circle cx={cx} cy={cy} r={38} className="cons-center-ring" />
          {image ? <image href={image} x={cx - 34} y={cy - 34} width={68} height={68} preserveAspectRatio="xMidYMid slice" clipPath={`url(#c-${uid})`} /> : <circle cx={cx} cy={cy} r={34} fill="#efeaff" />}
        </g>
        {nodes.map(({ t, x, y, i }) => (
          <g key={t.kind} className={`cons-node s-${t.status}`} style={{ ["--d" as string]: `${200 + i * 90}ms`, transformOrigin: `${x}px ${y}px` }}
            onMouseEnter={() => setHover(t)} onFocus={() => setHover(t)} onBlur={() => setHover(null)} tabIndex={0} role="img" aria-label={`${t.title}: ${STATE[t.status] ?? t.status}`}>
            {t.status === "needs_approval" && <circle cx={x} cy={y} r={17} className="pulse" />}
            {t.status === "in_progress" && <circle cx={x} cy={y} r={21} className="spin" />}
            <circle cx={x} cy={y} r={17} className="dot" />
            <text x={x} y={y + 1} className="ico" textAnchor="middle" dominantBaseline="central">{t.status === "done" ? "✓" : ICON[t.kind] ?? "•"}</text>
            <text x={x} y={y + 30} className="lbl" textAnchor="middle">{SHORT[t.kind] ?? t.title}</text>
          </g>
        ))}
      </svg>
      <figcaption className={`cons-cap ${focus ? `s-${focus.status}` : ""}`} aria-live="polite">
        {focus ? <><b>{focus.title}</b> · {STATE[focus.status] ?? focus.status}{focus.note ? <span>{focus.note}</span> : null}</> : <span>Tap a step to see what Riya is doing.</span>}
      </figcaption>
    </figure>
  );
}
