"use client";
import { useMemo, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { HOLD_FEE, departures, emi, fmt, groupTotal, ppPrice } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import PaxPicker from "./PaxPicker";

export default function BookingBox({ trip, startDate }: { trip: TripDTO; startDate: string }) {
  const { currency, from, adults, childAges, saved, toggleSaved, toast } = usePrefs();
  const deps = useMemo(() => departures(trip, startDate, from), [trip, startDate, from]);
  const [dep, setDep] = useState(0);
  const [months, setMonths] = useState(6);
  const [mode, setMode] = useState<"price" | "hold" | "enquiry">("price");
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });

  const d = deps[dep];
  const pp = ppPrice(trip, from) + d.adj;
  const { base, gst, total } = groupTotal(pp, adults, childAges);
  const people = adults + childAges.length;
  const depLabel = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", o);
  const wa = process.env.NEXT_PUBLIC_WHATSAPP;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const r = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode === "hold" ? "hold" : "enquiry",
          tripId: trip.id, departure: d.date, adults, children: childAges.length, fromCity: from,
          quotedTotal: Math.round(total), ...form,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setState({ busy: false, ok: mode === "hold"
        ? `Price held. Reference ${j.ref}. We'll call you within 2 hours to take the ${fmt(HOLD_FEE, "INR")} hold payment.`
        : `Thanks ${form.name.split(" ")[0]}! Reference ${j.ref}. A travel expert will reply within a few hours.` });
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch (err) {
      setState({ busy: false, err: (err as Error).message });
    }
  }

  return (
    <div className="book-box">
      <div className="panel">
        <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>From</div>
        <div className="price" style={{ fontSize: 30 }}>{fmt(pp, currency)} <small>/ person</small></div>
        <div className="emi" style={{ marginBottom: 14 }}>or {fmt(emi(pp, 6), currency)}/mo with 0% EMI</div>

        <h2 style={{ fontSize: 15, margin: "6px 0 8px" }}>Pick a departure</h2>
        <div className="dep-dates">
          {deps.map((x, i) => (
            <button key={x.date} aria-pressed={i === dep} onClick={() => setDep(i)}>
              <b>{depLabel(x.date, { weekday: "short", day: "numeric", month: "short" })}</b>
              <span className="mono">{fmt(ppPrice(trip, from) + x.adj, currency)}</span>
              {x.seats !== null && <span className="seats">{x.seats} seats left</span>}
            </button>
          ))}
        </div>

        <div style={{ margin: "14px 0" }}><PaxPicker /></div>

        <table className="breakdown">
          <tbody>
            <tr><td>{people} traveller{people > 1 ? "s" : ""}, {trip.nights} nights</td><td>{fmt(base, currency)}</td></tr>
            <tr><td>GST 5%</td><td>{fmt(gst, currency)}</td></tr>
            <tr className="total"><td>Total</td><td>{fmt(total, currency)}</td></tr>
          </tbody>
        </table>
        {trip.region !== "India" && <p className="muted" style={{ fontSize: 12 }}>TCS may be collected on overseas packages under Indian tax rules and can be claimed against your income tax.</p>}

        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>Pay monthly</div>
        <div className="emi-grid">
          {[3, 6, 9, 12].map((m) => (
            <button key={m} aria-pressed={months === m} onClick={() => setMonths(m)}>
              <span className="m">{m} mo</span><span className="v">{fmt(emi(total, m), currency)}</span>
              {m <= 6 ? <span className="z">NO-COST</span> : <span className="m">13% p.a.</span>}
            </button>
          ))}
        </div>

        {mode === "price" ? (
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <button className="btn hot" onClick={() => setMode("hold")}>Hold this price for 48 hours</button>
            <button className="btn" onClick={() => setMode("enquiry")}>Ask a question</button>
            <button className="btn" onClick={() => toast(toggleSaved(trip.id) ? "♥ Saved to your trips" : "Removed from saved trips")}>
              {saved.includes(trip.id) ? "♥ Saved" : "♡ Save trip"}
            </button>
            {wa && <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi Ribriz, I'm interested in "${trip.title}" leaving ${d.date} for ${people} people.`)}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
          </div>
        ) : (
          <form onSubmit={submit} className="form-grid" style={{ marginTop: 16 }}>
            <p className="full" style={{ margin: 0, fontSize: 14 }}>
              {mode === "hold"
                ? <>Hold <b>{fmt(total, currency)}</b> until we confirm. The {fmt(HOLD_FEE, "INR")} hold fee comes off your fare, or is refunded if you don&apos;t book.</>
                : <>Ask anything about this trip. We usually reply within a few hours.</>}
            </p>
            {state.ok ? <div className="notice ok full">{state.ok}</div> : <>
              <label className="full">Full name<input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="As on passport" /></label>
              <label>Mobile<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98xxx xxxxx" /></label>
              <label>Email<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
              <label className="full">Message (optional)<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Room type, food preferences, questions…" style={{ minHeight: 70 }} /></label>
              {state.err && <div className="notice err full">{state.err}</div>}
              <button className="btn hot full" type="submit" disabled={state.busy}>{state.busy ? "Sending…" : mode === "hold" ? "Request price hold" : "Send question"}</button>
            </>}
            <button type="button" className="btn full" onClick={() => { setMode("price"); setState({ busy: false }); }}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
