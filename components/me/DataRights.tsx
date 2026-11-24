"use client";
import { useState } from "react";

/** Download a copy of your data, or delete your account for good. */
export default function DataRights() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function erase() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/me/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: typed }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setBusy(false); setErr(j.error || "That didn't work. Please try again."); return; }
    try { sessionStorage.clear(); localStorage.removeItem("ribriz_prefs_v2"); } catch {}
    window.location.href = j.keptBookings ? "/?account=deleted&kept=1" : "/?account=deleted";
  }

  return (
    <section className="panel" style={{ maxWidth: 860, marginTop: 18 }}>
      <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>Your data</h2>
      <p className="muted" style={{ marginTop: 0 }}>Get a copy of everything we hold about you, or delete your account. See our <a href="/legal/privacy">privacy policy</a>.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href="/api/me/export">⬇ Download my data</a>
        <button className="btn danger" onClick={() => setOpen(!open)}>Delete my account</button>
      </div>
      {open && (
        <div className="del-box">
          <p><b>This can&apos;t be undone.</b> We&apos;ll delete your trips, documents, requests, alerts, reviews and everything Riya remembers, and sign you out. Confirmed bookings stay on record because tax law requires it, but you won&apos;t get any more emails.</p>
          <label className="fine">Type <b>DELETE</b> to confirm<input className="in" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></label>
          {err && <p className="appr-err" role="alert">{err}</p>}
          <button className="btn danger" disabled={typed !== "DELETE" || busy} onClick={erase}>{busy ? "Deleting…" : "Delete everything"}</button>
        </div>
      )}
    </section>
  );
}
