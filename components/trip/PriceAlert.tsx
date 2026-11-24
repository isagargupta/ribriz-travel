"use client";
import { useState } from "react";
import Consent from "@/components/legal/Consent";
import { usePrefs } from "../Prefs";
import { useBooking } from "./BookingContext";

/** "Tell me if it gets cheaper": Riya's daily agent watches the price and emails on a real drop. */
export default function PriceAlert() {
  const { trip, selected } = useBooking();
  const { me, from, toast } = usePrefs();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function watch(withEmail?: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/price-watch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trip.slug, date: selected?.date ?? null, from, ...(withEmail ? { email: withEmail } : {}) }),
      });
      const j = await r.json();
      if (j.needEmail) { setOpen(true); return; }
      if (!j.ok) { toast(j.error || "Couldn't set the alert.", { tone: "err" }); return; }
      setDone(j.message);
      setOpen(false);
      toast("Price alert on", { tone: "ok" });
    } catch {
      toast("Network problem. Try again.", { tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="price-alert on" role="status"><span aria-hidden>🔔</span> {done}</p>;
  return (
    <div className="price-alert">
      {!open ? (
        <button className="link-btn" disabled={busy} onClick={() => (me?.email ? watch() : setOpen(true))}>
          <span aria-hidden>🔔</span> {busy ? "Setting alert…" : "Alert me if the price drops"}
        </button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); watch(email); }}>
          <label htmlFor="pa-email" className="fine">We&apos;ll email you if {selected ? "this date" : "this trip"} gets cheaper. No spam.</label>
          <div className="pa-row">
            <input id="pa-email" className="in" type="email" required autoFocus autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn sm" disabled={busy}>{busy ? "…" : "Alert me"}</button>
          </div>
          <Consent action="setting an alert" />
        </form>
      )}
    </div>
  );
}
