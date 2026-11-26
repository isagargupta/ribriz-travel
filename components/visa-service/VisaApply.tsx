"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Consent from "../legal/Consent";
import { usePrefs } from "../Prefs";
import type { VisaProductView } from "@/lib/visa-service";
import { deadlineCheck, visaPrice } from "@/lib/visa-service-rules";

const PURPOSES = ["Tourism", "Visiting family or friends", "Business meeting"];
const fmtDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Steps 1–2 of a visa application. Then the application page takes over: documents, payment, tracking. */
export default function VisaApply({ product: p, travellers: n0, date: d0, country, flag }: { product: VisaProductView; travellers: number; date: string; country: string; flag: string }) {
  const router = useRouter();
  const { money, me } = usePrefs();
  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState({ arrive: d0, depart: "", purpose: PURPOSES[0] });
  const [names, setNames] = useState<string[]>(Array.from({ length: n0 }, () => ""));
  const [c, setC] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { if (me) setC((x) => ({ name: x.name || me.name || "", email: x.email || me.email, phone: x.phone || me.phone || "" })); }, [me]);
  useEffect(() => { if (me?.name && !names[0]) setNames((ns) => [me.name!, ...ns.slice(1)]); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const price = useMemo(() => visaPrice(p, names.length), [p, names.length]);
  const check = trip.arrive ? deadlineCheck(p.readyBy, trip.arrive) : null;
  const tripOk = !!trip.arrive && trip.arrive >= today && (!trip.depart || trip.depart >= trip.arrive);
  const peopleOk = names.every((x) => x.trim().length >= 2) && c.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(c.email) && c.phone.replace(/\D/g, "").length >= 8;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/visa/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: p.slug, travellers: names, arrive: trip.arrive, depart: trip.depart || null, purpose: trip.purpose, ...c }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't start your application.");
      router.push(`/visa/application/${j.ref}?t=${j.token}&new=1`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="vz-flow">
      <div className="vz-flow-main panel">
        <ol className="vz-progress" aria-label="Steps">
          {["Trip", "Travellers", "Documents", "Payment"].map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "now" : ""}><span>{i < step ? "✓" : i + 1}</span>{s}</li>)}
        </ol>

        {step === 0 && (
          <form className="vz-form" onSubmit={(e) => { e.preventDefault(); if (tripOk) setStep(1); }}>
            <h2>When are you travelling?</h2>
            <div className="vz-2">
              <label>Arriving in {country}<input type="date" required min={today} value={trip.arrive} onChange={(e) => setTrip({ ...trip, arrive: e.target.value })} /></label>
              <label>Leaving (optional)<input type="date" min={trip.arrive || today} value={trip.depart} onChange={(e) => setTrip({ ...trip, depart: e.target.value })} /></label>
            </div>
            <label>Purpose<select value={trip.purpose} onChange={(e) => setTrip({ ...trip, purpose: e.target.value })}>{PURPOSES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>How many travellers?
              <span className="vz-step"><button type="button" onClick={() => setNames(names.slice(0, Math.max(1, names.length - 1)))} aria-label="Fewer">−</button><b>{names.length}</b><button type="button" onClick={() => names.length < 9 && setNames([...names, ""])} aria-label="More">+</button></span>
            </label>
            {check && <p className={`vz-ready ${check}`}><span>Visa ready by</span><b>{fmtDay(p.readyBy)}</b><small>{check === "ok" ? "✓ In good time for your trip" : check === "tight" ? "⚠ Close to your travel date: finish today" : "✗ That's before your visa would be ready. Pick a later date or ask Riya."}</small></p>}
            <button className="btn hot lg" disabled={!tripOk}>Continue</button>
          </form>
        )}

        {step === 1 && (
          <form className="vz-form" onSubmit={(e) => { e.preventDefault(); if (peopleOk) submit(); }}>
            <h2>Who&apos;s travelling?</h2>
            <p className="muted" style={{ marginTop: -6 }}>Names exactly as printed on each passport.</p>
            {names.map((x, i) => (
              <label key={i}>Traveller {i + 1}<input required value={x} autoComplete={i === 0 ? "name" : "off"} placeholder="Full name as on passport" onChange={(e) => setNames(names.map((y, j) => (j === i ? e.target.value : y)))} /></label>
            ))}
            <h3>Where we send updates</h3>
            <div className="vz-2">
              <label>Your name<input required value={c.name} autoComplete="name" onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
              <label>Mobile<input required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
            </div>
            <label>Email<input required type="email" autoComplete="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
            <Consent action="applying" />
            {err && <div className="notice err">{err}</div>}
            <div className="vz-btns"><button type="button" className="btn" onClick={() => setStep(0)}>Back</button><button className="btn hot lg" disabled={!peopleOk || busy}>{busy ? "Starting…" : "Continue to documents"}</button></div>
          </form>
        )}
      </div>

      <aside className="vz-flow-side panel">
        <div className="vz-sum-head"><span className="vz-flag lg">{flag}</span><div><b>{country}</b><small>{p.name}</small></div></div>
        <dl className="vz-sum">
          <div><dt>Visa ready by</dt><dd>{fmtDay(p.readyBy)}</dd></div>
          <div><dt>Stay</dt><dd>{p.stayDays ? `${p.stayDays} days` : "–"}</dd></div>
          <div><dt>Travellers</dt><dd>{names.length}</dd></div>
          <div><dt>Per traveller</dt><dd>{money(price.perPerson)}</dd></div>
          <div className="tot"><dt>Total</dt><dd>{money(price.total)}</dd></div>
        </dl>
        <p className="fine">Includes government fee, service fee and 18% GST on the service fee. You pay after uploading documents.</p>
      </aside>
    </div>
  );
}
