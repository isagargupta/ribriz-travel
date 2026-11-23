"use client";
import { useState } from "react";
import { usePrefs } from "./Prefs";

export default function PlanForm() {
  const { adults, childAges, from } = usePrefs();
  const [f, setF] = useState({ name: "", phone: "", email: "", dest: "", month: "", budget: "", style: "", message: "" });
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    const message = [
      f.dest && `Destination: ${f.dest}`,
      f.month && `When: ${f.month}`,
      f.budget && `Budget per person: ${f.budget}`,
      f.style && `Style: ${f.style}`,
      f.message,
    ].filter(Boolean).join("\n");
    try {
      const r = await fetch("/api/enquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "custom", name: f.name, phone: f.phone, email: f.email, adults, childAges, from, message }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setState({ busy: false, ok: `Thanks ${f.name.split(" ")[0]}! Your reference is ${j.ref}. A travel expert will send you a costed plan within one working day.` });
    } catch (err) { setState({ busy: false, err: (err as Error).message }); }
  }

  if (state.ok) return <div className="panel co-done pop-in"><div className="tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div><h3>Request sent</h3><p>{state.ok}</p></div>;

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <label>Full name<input required autoComplete="name" value={f.name} onChange={up("name")} /></label>
      <label>Mobile<input required inputMode="tel" autoComplete="tel" value={f.phone} onChange={up("phone")} placeholder="+91 98xxx xxxxx" /></label>
      <label className="full">Email<input required type="email" autoComplete="email" value={f.email} onChange={up("email")} /></label>
      <label>Where would you like to go?<input value={f.dest} onChange={up("dest")} placeholder="e.g. Switzerland and Paris" /></label>
      <label>When?<input value={f.month} onChange={up("month")} placeholder="e.g. May 2027, 10 nights" /></label>
      <label>Budget per person<select value={f.budget} onChange={up("budget")}>
        <option value="">Not sure yet</option><option>Under ₹50,000</option><option>₹50,000 – ₹1,00,000</option><option>₹1,00,000 – ₹2,00,000</option><option>Above ₹2,00,000</option>
      </select></label>
      <label>Travel style<select value={f.style} onChange={up("style")}>
        <option value="">Any</option><option>Honeymoon</option><option>Family</option><option>Group tour</option><option>Adventure</option><option>Luxury</option>
      </select></label>
      <label className="full">Anything else?<textarea value={f.message} onChange={up("message")} placeholder="Hotels you like, food preferences, must-see places…" /></label>
      <p className="full muted" style={{ margin: 0, fontSize: 13 }}>Travellers: {adults} adult{adults > 1 ? "s" : ""}{childAges.length ? `, ${childAges.length} child${childAges.length > 1 ? "ren" : ""}` : ""} from {from}. Change these in the search box on the home page.</p>
      {state.err && <div className="notice err full">{state.err}</div>}
      <button className="btn hot full" type="submit" disabled={state.busy} style={{ padding: 14 }}>{state.busy ? <span className="spinner light" aria-label="Sending" /> : "Send my trip request"}</button>
    </form>
  );
}
