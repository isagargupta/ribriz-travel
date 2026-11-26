"use client";
import { useState } from "react";

/** Opt in to WhatsApp updates for the important things: payments, bookings, options ready, urgent alerts. */
export default function WhatsAppOptIn({ initialOn, initialNumber }: { initialOn: boolean; initialNumber: string }) {
  const [on, setOn] = useState(initialOn);
  const [num, setNum] = useState(initialNumber);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: boolean) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/me/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: next, number: num }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setOn(j.on); if (j.number) setNum("+" + j.number); setMsg({ ok: true, text: j.on ? "WhatsApp updates are on." : "WhatsApp updates are off." }); }
    else setMsg({ ok: false, text: j.error ?? "Couldn't save." });
    setBusy(false);
  }

  return (
    <div className="phone-setup row">
      <h2>💬 Updates on WhatsApp</h2>
      <p className="muted">{on ? `On for ${num}. You'll get payments, bookings, options to choose and urgent alerts here.` : "Get the important updates on WhatsApp too: payments, confirmed bookings, options ready to choose and urgent alerts. No marketing."}</p>
      <div className="ps-acts">
        {!on && <input className="in" value={num} onChange={(e) => setNum(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" aria-label="WhatsApp number" style={{ font: "inherit", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)" }} />}
        {on ? <button type="button" className="link-btn" disabled={busy} onClick={() => save(false)}>Turn off</button>
          : <button type="button" className="btn hot sm" disabled={busy || !num.trim()} onClick={() => save(true)}>Turn on</button>}
      </div>
      {!on && <small className="muted">By turning this on you agree to receive these updates from Ribriz Travel on WhatsApp. Turn them off here any time.</small>}
      {msg && <p className={msg.ok ? "ps-msg" : "warn-txt"} role="status">{msg.text}</p>}
    </div>
  );
}
