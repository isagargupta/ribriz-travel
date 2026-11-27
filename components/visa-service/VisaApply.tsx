"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import Consent from "../legal/Consent";
import { usePrefs } from "../Prefs";
import type { VisaProductView } from "@/lib/visa-service";
import { deadlineCheck, visaPrice } from "@/lib/visa-service-rules";
import { WizardFrame } from "./Wizard";
import { Icon, fmtDay } from "./ui";
import { useTween } from "./useTween";

const PURPOSES = ["Tourism", "Visiting family or friends", "Business meeting"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Field({ label, value, onChange, type = "text", error, hint, ...rest }: { label: string; value: string; onChange: (v: string) => void; type?: string; error?: string | null; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = useId();
  return (
    <div className={`vx-field ${error ? "bad" : ""} ${type === "date" ? "has" : ""}`}>
      <input id={id} type={type} value={value} placeholder=" " onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-m` : undefined} {...rest} />
      <label htmlFor={id}>{label}</label>
      {error ? <span className="err" id={`${id}-m`}>{error}</span> : hint ? <span className="hint" id={`${id}-m`}>{hint}</span> : null}
    </div>
  );
}

/** Steps 1–2 of the application wizard. The application page carries on with documents and payment. */
export default function VisaApply({ product: p, travellers: n0, date: d0, country, code }: { product: VisaProductView; travellers: number; date: string; country: string; code: string }) {
  const router = useRouter();
  const { money, me } = usePrefs();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"enter" | "back">("enter");
  const [trip, setTrip] = useState({ arrive: d0, depart: "", purpose: PURPOSES[0] });
  const [names, setNames] = useState<string[]>(Array.from({ length: n0 }, () => ""));
  const [c, setC] = useState({ name: "", email: "", phone: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { if (me) setC((x) => ({ name: x.name || me.name || "", email: x.email || me.email, phone: x.phone || me.phone || "" })); }, [me]);
  useEffect(() => { if (me?.name) setNames((ns) => (ns[0] ? ns : [me.name!, ...ns.slice(1)])); }, [me]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const price = useMemo(() => visaPrice(p, names.length), [p, names.length]);
  const total = useTween(price.total);
  const check = trip.arrive ? deadlineCheck(p.readyBy, trip.arrive) : null;

  const e1 = { arrive: !trip.arrive ? "Pick your arrival date." : trip.arrive < today ? "That date has passed." : null, depart: trip.depart && trip.depart < trip.arrive ? "Leaving must be after arriving." : null };
  const e2 = {
    names: names.map((x) => (x.trim().length < 2 ? "Full name as printed on the passport." : null)),
    name: c.name.trim().length < 2 ? "Add your name." : null,
    phone: c.phone.replace(/\D/g, "").length < 10 ? "A mobile number with at least 10 digits." : null,
    email: !EMAIL.test(c.email.trim()) ? "A valid email: we send your visa here." : null,
  };
  const ok1 = !e1.arrive && !e1.depart;
  const ok2 = !e2.names.some(Boolean) && !e2.name && !e2.phone && !e2.email;
  const show = (k: string, e: string | null) => (touched[k] || touched.all ? e : null);

  const next = () => { if (step === 0) { if (!ok1) return setTouched({ ...touched, all: true }); setDir("enter"); setTouched({}); setStep(1); } else submit(); };
  async function submit() {
    if (!ok2) { setTouched({ all: true }); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/visa/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: p.slug, travellers: names, arrive: trip.arrive, depart: trip.depart || null, purpose: trip.purpose, ...c }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't start your application.");
      router.push(`/visa/application/${j.ref}?t=${j.token}&new=1`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const summary = (
    <>
      <h3>Your application</h3>
      <div className="vx-sum-row"><span>Visa</span><b>{p.name}</b></div>
      <div className="vx-sum-row"><span>Ready by</span><b>{fmtDay(p.readyBy)}</b></div>
      {trip.arrive && <div className="vx-sum-row"><span>Travel</span><b>{fmtDay(trip.arrive)}{trip.depart ? ` – ${fmtDay(trip.depart)}` : ""}</b></div>}
      <div className="vx-sum-row"><span>Travellers</span><b>{names.length}</b></div>
      <div className="vx-sum-row"><span>Per traveller</span><b>{money(price.perPerson)}{p.feeOnRequest ? " + govt fee" : ""}</b></div>
      <div className="vx-sum-total"><span>{p.feeOnRequest ? "Our fee" : "Total"}</span><b>{money(total)}</b></div>
      <div className="vx-assure" style={{ marginTop: 14 }}><span><Icon name="check" /> Nothing to pay yet</span><span><Icon name="lock" /> Documents stored privately</span></div>
    </>
  );

  return (
    <WizardFrame code={code} country={country} visa={p.name} step={step} summary={summary}>
      <form key={step} className={`vx-stage ${dir}`} noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
        {step === 0 ? (
          <>
            <h2>When are you travelling?</h2>
            <p className="sub">We&apos;ll check your visa will be ready in time.</p>
            <div className="vx-fields">
              <div className="row">
                <Field label={`Arriving in ${country}`} type="date" min={today} value={trip.arrive} onChange={(v) => setTrip({ ...trip, arrive: v })} onBlur={() => setTouched({ ...touched, arrive: true })} error={show("arrive", e1.arrive)} />
                <Field label="Leaving (optional)" type="date" min={trip.arrive || today} value={trip.depart} onChange={(v) => setTrip({ ...trip, depart: v })} error={show("depart", e1.depart)} />
              </div>
              {check && (
                <div className={`vx-eta ${check}`} role="status">
                  <span className="vx-ico"><Icon name="calendar" /></span>
                  <div><small>{check === "late" ? "Not in time" : check === "tight" ? "Cutting it close" : "In good time"}</small><b>Visa ready by {fmtDay(p.readyBy, true)}</b><p>{check === "ok" ? "Well before you fly." : check === "tight" ? "Finish today so we can file tomorrow." : "That's before it would be ready: pick a later date or ask Riya about faster options."}</p></div>
                </div>
              )}
              <p className="vx-sublabel">Purpose of the trip</p>
              <div className="vx-purpose" role="group" aria-label="Purpose">{PURPOSES.map((x) => <button key={x} type="button" aria-pressed={trip.purpose === x} onClick={() => setTrip({ ...trip, purpose: x })}>{x}</button>)}</div>
            </div>
          </>
        ) : (
          <>
            <h2>Who&apos;s travelling?</h2>
            <p className="sub">Names exactly as printed on each passport. You can add up to 9 travellers.</p>
            <div className="vx-fields">
              {names.map((x, i) => (
                <div key={i} className="vx-trav">
                  <span className="vx-avatar">{x.trim()[0]?.toUpperCase() ?? i + 1}</span>
                  <Field label={`Traveller ${i + 1}: full name`} value={x} autoComplete={i === 0 ? "name" : "off"} onChange={(v) => setNames(names.map((y, j) => (j === i ? v : y)))} onBlur={() => setTouched({ ...touched, [`n${i}`]: true })} error={show(`n${i}`, e2.names[i])} />
                  {names.length > 1 ? <button type="button" className="vx-x" aria-label={`Remove traveller ${i + 1}`} onClick={() => setNames(names.filter((_, j) => j !== i))}>✕</button> : <span />}
                </div>
              ))}
              {names.length < 9 && <button type="button" className="vx-add" onClick={() => setNames([...names, ""])}>+ Add traveller</button>}
              <p className="vx-sublabel" style={{ marginTop: 10 }}>Where we send updates and your visa</p>
              <div className="row">
                <Field label="Your name" value={c.name} autoComplete="name" onChange={(v) => setC({ ...c, name: v })} onBlur={() => setTouched({ ...touched, name: true })} error={show("name", e2.name)} />
                <Field label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={c.phone} onChange={(v) => setC({ ...c, phone: v })} onBlur={() => setTouched({ ...touched, phone: true })} error={show("phone", e2.phone)} />
              </div>
              <Field label="Email" type="email" autoComplete="email" value={c.email} onChange={(v) => setC({ ...c, email: v })} onBlur={() => setTouched({ ...touched, email: true })} error={show("email", e2.email)} hint="Your application link and visa are sent here." />
              <Consent action="applying" />
              {err && <div className="vx-note err" role="alert">{err}</div>}
            </div>
          </>
        )}
        <div className="vx-actions">
          {step > 0 ? <button type="button" className="vx-btn ghost" onClick={() => { setDir("back"); setStep(step - 1); }}>← Back</button> : <span />}
          <button className="vx-btn primary lg" disabled={busy}>{busy ? "Creating your application…" : step === 0 ? "Continue" : "Continue to documents"} {!busy && <Icon name="arrow" size={18} />}</button>
        </div>
      </form>
    </WizardFrame>
  );
}
