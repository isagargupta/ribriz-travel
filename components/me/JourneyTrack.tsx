"use client";
import { useEffect, useState } from "react";
import type { DashTask } from "@/lib/dashboard";

const ICON: Record<string, string> = { choose_trip: "🧭", price_hold: "🔒", visa: "🛂", insurance: "🛡️", forex: "💱", flights: "✈️", hotels: "🏨", prep: "🧳" };
const SHORT: Record<string, string> = { choose_trip: "Trip", price_hold: "Price", visa: "Visa", insurance: "Cover", forex: "Forex", flights: "Flights", hotels: "Hotel", prep: "Pack" };
const STATE: Record<string, string> = { done: "Done", in_progress: "Riya is on it", waiting: "With our team", needs_approval: "Needs your OK", todo: "Coming up" };

/**
 * A trip's steps as one journey line. The line fills up to the current step
 * and a small plane glides there; the current step pulses. Tap any step to
 * see its note. Steps that aren't needed are left out.
 */
export default function JourneyTrack({ tasks }: { tasks: DashTask[] }) {
  const steps = tasks.filter((t) => t.status !== "skipped");
  const firstOpen = steps.findIndex((t) => t.status !== "done");
  const current = firstOpen === -1 ? steps.length - 1 : firstOpen;
  const target = steps.length > 1 ? (firstOpen === -1 ? 1 : current / (steps.length - 1)) : 1;
  const [p, setP] = useState(0); // animated fill, 0..1
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setP(target), 120); return () => clearTimeout(t); }, [target]);
  // what the note shows: the step you tapped, else anything waiting for you, else where Riya is
  const needs = steps.findIndex((t) => t.status === "needs_approval");
  const focus = steps[pick ?? (needs >= 0 ? needs : current)];
  const allDone = firstOpen === -1;

  return (
    <div className="jt">
      <div className="jt-track" style={{ ["--p" as string]: p, ["--n" as string]: steps.length }}>
        <div className="jt-rail" aria-hidden="true"><i className="jt-fill" /><span className="jt-plane">{allDone ? "🏁" : "✈"}</span></div>
        <ol className="jt-steps">
          {steps.map((t, i) => (
            <li key={t.kind} className={`jt-step s-${t.status} ${i === current && !allDone ? "now" : ""} ${pick === i ? "picked" : ""}`} style={{ ["--i" as string]: i }}>
              <button type="button" onClick={() => setPick(pick === i ? null : i)} aria-label={`${t.title}: ${STATE[t.status] ?? t.status}`} aria-pressed={pick === i}>
                <span className="jt-dot">{t.status === "done" ? "✓" : ICON[t.kind] ?? "•"}</span>
                <span className="jt-lbl">{SHORT[t.kind] ?? t.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {focus && (
        <div key={focus.kind + (pick ?? "")} className={`jt-now s-${focus.status}`} aria-live="polite">
          <span className="jt-now-ico" aria-hidden="true">{focus.status === "done" ? "✓" : ICON[focus.kind]}</span>
          <div>
            <b>{allDone && pick === null ? "Everything's sorted" : focus.title}</b>
            <span className="jt-now-state">{allDone && pick === null ? "Riya will send your checklist before you leave" : STATE[focus.status] ?? focus.status}</span>
            {focus.note && !(allDone && pick === null) && <p>{focus.note}</p>}
          </div>
          {(focus.status === "in_progress" || focus.status === "waiting") && <span className="jt-work" aria-hidden="true"><i /><i /><i /></span>}
        </div>
      )}
    </div>
  );
}
