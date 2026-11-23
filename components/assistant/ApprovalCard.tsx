"use client";
import { useState } from "react";
import { usePrefs } from "../Prefs";

export interface ApprovalCardData {
  id: string; action: string; summary: string; amountInr: number | null; status: string; expiresAt: string;
  lines: string[]; needsContact: boolean; contactDefaults: { name: string; phone: string; email: string };
  result?: unknown;
}

type Outcome = { status: "done" | "declined"; message: string; ref?: string };

/**
 * One-tap approval for an action the agent prepared. Nothing binding happens
 * until the traveller presses Approve.
 */
export default function ApprovalCard({ card, onDecided, compact = false }: { card: ApprovalCardData; onDecided?: (o: Outcome) => void; compact?: boolean }) {
  const { money } = usePrefs();
  const [state, setState] = useState<"idle" | "busy" | "done" | "declined">(card.status === "done" ? "done" : card.status === "declined" ? "declined" : "idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [c, setC] = useState(card.contactDefaults);
  const expired = card.status === "expired" || (card.status === "pending" && new Date(card.expiresAt) < new Date());

  async function decide(decision: "approve" | "decline") {
    setState("busy"); setErr(null);
    try {
      const r = await fetch(`/api/approvals/${card.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, contact: card.needsContact ? c : undefined }),
      });
      const j = await r.json();
      if (!r.ok) { setState("idle"); setErr(j.error || "That didn't work. Please try again."); return; }
      setState(j.status === "declined" ? "declined" : "done"); setMsg(j.message);
      onDecided?.({ status: j.status, message: j.message, ref: j.ref });
    } catch {
      setState("idle"); setErr("You seem to be offline. Please try again.");
    }
  }

  const offer = card.action === "accept_offer";
  const icon = card.action === "price_hold" ? "🔒" : offer ? "✨" : "🧾";
  return (
    <div className={`appr ${state} ${compact ? "compact" : ""}`}>
      <div className="appr-head">
        <span className="appr-ico" aria-hidden="true">{icon}</span>
        <div><small>{state === "done" ? (offer ? "Chosen" : "Done") : state === "declined" ? (offer ? "Passed" : "Not now") : expired ? "Expired" : offer ? "Option from our team" : "Needs your OK"}</small><b>{card.summary}</b></div>
        {card.amountInr ? <span className="appr-amt">{money(card.amountInr)}</span> : null}
      </div>
      <ul className="appr-lines">{card.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>

      {state === "done" || state === "declined" ? (
        <p className={`appr-msg ${state}`}>{state === "done" ? "✓ " : ""}{msg ?? (state === "done" ? "Done." : "Skipped.")}</p>
      ) : expired ? (
        <p className="appr-msg">{offer ? "This option expired. Ask Riya and our team will refresh it." : <>This expired. Ask Riya to prepare it again with today&apos;s price.</>}</p>
      ) : (
        <>
          {card.needsContact && (
            <div className="appr-contact">
              <input aria-label="Full name" placeholder="Full name" autoComplete="name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
              <input aria-label="Mobile" placeholder="Mobile" inputMode="tel" autoComplete="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
              <input aria-label="Email" placeholder="Email" type="email" autoComplete="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
            </div>
          )}
          {err && <p className="appr-err" role="alert">{err}</p>}
          <div className="appr-btns">
            <button className="btn sm" disabled={state === "busy"} onClick={() => decide("decline")}>{offer ? "Pass" : "Not now"}</button>
            <button className="btn hot" disabled={state === "busy"} onClick={() => decide("approve")}>{state === "busy" ? <span className="spinner" aria-label="Working" /> : offer ? "Choose this" : "Approve"}</button>
          </div>
        </>
      )}
    </div>
  );
}
