"use client";
import { useState } from "react";

/** "Need a GST invoice for your company?": GSTIN, registered name and address, checked before saving. */
export default function BillingForm({ refCode, token, initial, locked }: { refCode: string; token: string | null; initial: { name: string | null; gstin: string | null; address: string | null }; locked: boolean }) {
  const [open, setOpen] = useState(!!initial.gstin);
  const [f, setF] = useState({ name: initial.name ?? "", gstin: initial.gstin ?? "", address: initial.address ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (locked) return initial.gstin ? <p className="fine">Invoiced to {initial.name} · GSTIN {initial.gstin}</p> : null;
  if (!open) return <button type="button" className="link-btn bill-open" onClick={() => setOpen(true)}>Booking for a company? Add GST details for the invoice</button>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/payments/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: refCode, t: token, ...f }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't save.");
      setF((x) => ({ ...x, gstin: j.gstin ?? "" }));
      setMsg({ ok: true, text: j.gstin ? "Saved. Your tax invoice will show your company's GSTIN." : "Saved." });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." }); }
    setBusy(false);
  }

  return (
    <form className="bill" onSubmit={save}>
      <b>GST details for your invoice</b>
      <label>GSTIN<input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="e.g. 27AAPFU0939F1ZV" maxLength={15} autoCapitalize="characters" spellCheck={false} /></label>
      <label>Registered company name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="As on the GST certificate" /></label>
      <label>Billing address<textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} rows={2} placeholder="Registered address" /></label>
      <div className="bill-acts">
        <button className="btn sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save GST details"}</button>
        {msg && <span className={msg.ok ? "ok-txt" : "warn-txt"} role="status">{msg.text}</span>}
      </div>
      <small className="muted">Your invoice is issued once the trip is fully paid. Add details before then; after that our team reissues it if needed.</small>
    </form>
  );
}
