"use client";
import { useState } from "react";
import { fmtDate } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import Sheet from "../ui/Sheet";
import { useBooking } from "./BookingContext";

export default function QuestionSheet() {
  const { trip, selected, question, setQuestion } = useBooking();
  const { from, adults, childAges } = usePrefs();
  const [f, setF] = useState({ name: "", phone: "", email: "", message: "" });
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const r = await fetch("/api/enquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "enquiry", tripId: trip.id, departureId: selected?.id, adults, childAges, from, ...f }),
      });
      const j = await r.json();
      setState(r.ok ? { ok: j.ref } : { err: j.error || "Something went wrong." });
    } catch { setState({ err: "You seem to be offline. Try again." }); }
  }

  const close = () => { setQuestion(false); if (state.ok) { setState({}); setF({ ...f, message: "" }); } };

  return (
    <Sheet open={question} onClose={close} title="Ask about this trip">
      {state.ok ? (
        <div className="co-done">
          <div className="tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
          <h3>Question sent</h3>
          <p className="muted">Reference <b className="mono">{state.ok}</b>. A travel expert usually replies within a few hours.</p>
          <button className="btn primary" onClick={close}>Close</button>
        </div>
      ) : (
        <form className="form-grid" onSubmit={submit}>
          <p className="full muted" style={{ margin: 0 }}>{trip.title}{selected ? ` · around ${fmtDate(selected.date, { day: "numeric", month: "short" })}` : ""}</p>
          <label className="full">Your question<textarea data-autofocus required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Can we add a night in Ubud? Is the hotel good for toddlers?" /></label>
          <label className="full">Full name<input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Mobile<input required inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label>Email<input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          {state.err && <div className="notice err full" role="alert">{state.err}</div>}
          <button className="btn hot full" disabled={state.busy}>{state.busy ? <span className="spinner" aria-label="Sending" /> : "Send question"}</button>
        </form>
      )}
    </Sheet>
  );
}
