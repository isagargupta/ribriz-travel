"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HOLD_HOURS, addDays, fmtDate } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import PaxPicker from "../PaxPicker";
import Money from "../ui/Money";
import Sheet from "../ui/Sheet";
import { useBooking } from "./BookingContext";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Trip", "Travellers", "Confirm"];
const DRAFT = "ribriz_contact";

interface Contact { name: string; phone: string; email: string; others: string[]; message: string }

export default function CheckoutSheet() {
  const { trip, selected, q, checkout, setCheckout } = useBooking();
  const { from, adults, childAges, toast, me } = usePrefs();
  const [step, setStep] = useState<Step>(0);
  const [c, setC] = useState<Contact>({ name: "", phone: "", email: "", others: [], message: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [priceMoved, setPriceMoved] = useState<number | null>(null);
  const [done, setDone] = useState<{ ref: string; total: number; payPath?: string } | null>(null);

  // restore contact details typed earlier in this browser session
  useEffect(() => {
    try { const d = sessionStorage.getItem(DRAFT); if (d) setC((x) => ({ ...x, ...JSON.parse(d), others: [] })); } catch {}
  }, []);
  // signed-in customers get their saved details filled in
  useEffect(() => {
    if (me) setC((x) => ({ ...x, name: x.name || me.name || "", phone: x.phone || me.phone || "", email: x.email || me.email }));
  }, [me]);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT, JSON.stringify({ name: c.name, phone: c.phone, email: c.email })); } catch {}
  }, [c.name, c.phone, c.email]);
  useEffect(() => { if (checkout) { setStep(done ? 3 : 0); setErr(null); } }, [checkout]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPriceMoved(null); }, [q?.total]);

  if (!selected || !q) return null;
  const travellers = adults + childAges.length;
  const others = Array.from({ length: travellers - 1 }, (_, i) => c.others[i] ?? "");
  const ret = addDays(selected.date, trip.nights);
  const close = () => { setCheckout(false); if (done) { setDone(null); setStep(0); setAgree(false); } };

  const contactOk = c.name.trim().length >= 2 && /^\+?[\d\s()-]{7,20}$/.test(c.phone.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim());

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/holds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureId: selected!.id, adults, childAges, from,
          name: c.name, phone: c.phone, email: c.email, travellers: others, message: c.message,
          expectedTotal: priceMoved ?? q!.total,
        }),
      });
      const j = await r.json();
      if (r.status === 409 && j.total) { setPriceMoved(j.total); setErr(j.error); return; }
      if (!r.ok) { setErr(j.error || "Something went wrong. Please try again."); return; }
      setDone({ ref: j.ref, total: j.total, payPath: j.payPath });
      setStep(3);
    } catch {
      setErr("You seem to be offline. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  function downloadIcs() {
    const d = (s: string) => s.replace(/-/g, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ribriz Travel//EN", "BEGIN:VEVENT",
      `UID:${done?.ref}@ribriz`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${d(selected!.date)}`, `DTEND;VALUE=DATE:${d(addDays(ret, 1))}`,
      `SUMMARY:${trip.title} (Ribriz ${done?.ref})`, `DESCRIPTION:Price hold ${done?.ref}. We'll confirm by email.`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = `ribriz-${done?.ref}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const summary = (
    <div className="co-trip">
      <span className="co-img"><Image src={trip.image} alt="" fill sizes="96px" /></span>
      <div>
        <b>{trip.title}</b>
        <small>{fmtDate(selected.date, { weekday: "short", day: "numeric", month: "short" })} – {fmtDate(ret, { day: "numeric", month: "short", year: "numeric" })} · {trip.nights} nights</small>
        <small>{travellers} traveller{travellers > 1 ? "s" : ""}{trip.flight ? ` · flying from ${from}` : ""}</small>
      </div>
    </div>
  );

  const footer = step === 3 ? (
    <button className="btn primary block" onClick={close}>Done</button>
  ) : (
    <div className="co-foot">
      <div><small className="muted">Total incl. GST</small><Money inr={priceMoved ?? q.total} className="price" /></div>
      <div className="co-btns">
        {step > 0 && <button className="btn" onClick={() => { setStep((s) => (s - 1) as Step); setErr(null); }}>Back</button>}
        {step === 0 && <button className="btn hot" onClick={() => setStep(1)}>Continue</button>}
        {step === 1 && <button className="btn hot" disabled={!contactOk} onClick={() => setStep(2)}>Review</button>}
        {step === 2 && <button className="btn hot" disabled={!agree || busy} onClick={submit}>{busy ? <span className="spinner" aria-label="Sending" /> : priceMoved ? "Confirm new price" : "Reserve now"}</button>}
      </div>
    </div>
  );

  return (
    <Sheet open={checkout} onClose={close} title={step === 3 ? "Price reserved" : "Reserve your trip"} footer={footer}>
      {step < 3 && (
        <ol className="stepper-bar" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "on" : ""} aria-current={i === step ? "step" : undefined}>
              <span>{i < step ? "✓" : i + 1}</span>{s}
            </li>
          ))}
        </ol>
      )}

      <div className="co-step" key={step}>
        {step === 0 && (
          <>
            {summary}
            <PaxPicker className="field boxed" />
            <table className="breakdown">
              <tbody>
                {q.lines.map((l) => <tr key={l.label}><td>{l.label}<small>{l.detail}</small></td><td><Money inr={l.amount} /></td></tr>)}
                <tr><td>GST 5%</td><td><Money inr={q.gst} /></td></tr>
                <tr className="total"><td>Total</td><td><Money inr={q.total} /></td></tr>
              </tbody>
            </table>
            <div className="co-note">
              <b>How reserving works</b>
              <ol>
                <li>We hold this exact price for {HOLD_HOURS} hours. Nothing to pay now.</li>
                <li>A travel expert confirms flights and rooms by email within 2 working hours.</li>
                <li>Pay <Money inr={q.deposit} /> to book. The rest is due 30 days before you leave.</li>
              </ol>
            </div>
          </>
        )}

        {step === 1 && (
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (contactOk) setStep(2); }}>
            <p className="full muted" style={{ margin: 0 }}>Lead traveller. We&apos;ll only use these details for this trip.</p>
            <label className="full">Full name (as on passport)<input data-autofocus required autoComplete="name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
            <label>Mobile<input required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
            <label>Email<input required type="email" autoComplete="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
            {others.length > 0 && <p className="full lab" style={{ margin: "6px 0 0" }}>Other travellers (optional, you can add these later)</p>}
            {others.map((v, i) => (
              <label key={i}>{i < adults - 1 ? `Adult ${i + 2}` : `Child ${i - adults + 2} (age ${childAges[i - adults + 1]})`}
                <input value={v} autoComplete="off" onChange={(e) => { const o = [...others]; o[i] = e.target.value; setC({ ...c, others: o }); }} />
              </label>
            ))}
            <label className="full">Requests (optional)<textarea value={c.message} placeholder="Room type, dietary needs, celebrations…" onChange={(e) => setC({ ...c, message: e.target.value })} /></label>
            <button type="submit" hidden />
          </form>
        )}

        {step === 2 && (
          <>
            {summary}
            <dl className="co-review">
              <dt>Lead traveller</dt><dd>{c.name}<br /><span className="muted">{c.phone} · {c.email}</span></dd>
              {others.some(Boolean) && <><dt>Also travelling</dt><dd>{others.filter(Boolean).join(", ")}</dd></>}
              {c.message && <><dt>Requests</dt><dd>{c.message}</dd></>}
              <dt>Total</dt><dd><b><Money inr={priceMoved ?? q.total} /></b> incl. GST · deposit <Money inr={q.deposit} /></dd>
              <dt>Cancellation</dt><dd>{trip.freeCancel ? "Free until 30 days before departure." : "Fees apply from booking; we'll send them in writing."}</dd>
            </dl>
            <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the <a href="/legal/terms" target="_blank">Terms of booking</a> and <a href="/legal/privacy" target="_blank">Privacy policy</a>, and to be contacted by email about this trip.</label>
            {err && <div className={`notice ${priceMoved ? "warn" : "err"}`} role="alert">{err}</div>}
          </>
        )}

        {step === 3 && done && (
          <div className="co-done">
            <div className="tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
            <h3>Your price is held for {HOLD_HOURS} hours</h3>
            <p className="muted">We&apos;ve emailed the details to {c.email}. Your reference is</p>
            <button className="ref" onClick={() => navigator.clipboard?.writeText(done.ref).then(() => toast("Reference copied", { tone: "ok" })).catch(() => {})} title="Copy reference">{done.ref} <small>copy</small></button>
            {summary}
            <ol className="timeline">
              <li className="done"><b>Price held</b><span>Just now · <Money inr={done.total} /></span></li>
              <li><b>Expert confirmation</b><span>Within 2 working hours, by email to {c.email}</span></li>
              <li><b>Pay deposit to book</b><span><Money inr={q.deposit} />, rest 30 days before</span></li>
            </ol>
            {done.payPath && <Link className="btn hot lg" href={done.payPath} onClick={close} style={{ justifySelf: "center" }}>🔒 Pay <Money inr={q.deposit} /> deposit &amp; book now</Link>}
            <div className="co-btns" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn" onClick={downloadIcs}>Add to calendar</button>
              <Link className="btn blue" href={me ? "/me" : `/booking?ref=${done.ref}`} onClick={close}>{me ? "See my trips" : "View my booking"}</Link>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
