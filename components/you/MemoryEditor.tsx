"use client";
import { useState } from "react";
import { usePrefs } from "../Prefs";
import { THEMES } from "@/lib/pricing";
import { PACES, REGIONS, TRAVELS_WITH, monthName, type Note, type Prefs } from "@/lib/profile-rules";
import { askRiya } from "../assistant/Assistant";

interface Profile { prefs: Prefs; notes: Note[]; updatedAt: string | null }
const LIKES = THEMES.map((t) => t.key).concat(["city", "luxury"]).filter((k, i, a) => a.indexOf(k) === i);
const label = (k: string) => THEMES.find((t) => t.key === k)?.label ?? k[0].toUpperCase() + k.slice(1);

function Chips<T extends string | number>({ all, on, toggle, show = String }: { all: readonly T[]; on: T[]; toggle: (v: T) => void; show?: (v: T) => string }) {
  return (
    <div className="mem-chips">
      {all.map((v) => <button type="button" key={String(v)} className="mem-chip" aria-pressed={on.includes(v)} onClick={() => toggle(v)}>{show(v)}</button>)}
    </div>
  );
}

/** Edit what Riya remembers. Saves the whole profile; notes are added or erased one by one. */
export default function MemoryEditor({ initial }: { initial: Profile }) {
  const { toast } = usePrefs();
  const [p, setP] = useState<Prefs>(initial.prefs);
  const [notes, setNotes] = useState<Note[]>(initial.notes);
  const [note, setNote] = useState("");
  const [avoid, setAvoid] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const empty = !Object.keys(p).length && !notes.length;

  const upd = (patch: Prefs) => { setP((x) => ({ ...x, ...patch })); setDirty(true); };
  const toggle = <K extends "likes" | "regions" | "months">(k: K) => (v: NonNullable<Prefs[K]>[number]) => {
    const cur = (p[k] ?? []) as (typeof v)[];
    upd({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Prefs);
  };

  async function save(withNote?: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs: p, ...(withNote ? { note: withNote } : {}) }) });
      const j = await r.json();
      if (!r.ok) { toast(j.error || "Couldn't save.", { tone: "err" }); return; }
      setP(j.prefs); setNotes(j.notes); setDirty(false);
      if (withNote) { if (j.refused) toast("That note looks like an ID number or contact detail, so it wasn't saved.", { tone: "err" }); else setNote(""); }
      toast("Saved. Riya will use this from now on.", { tone: "ok" });
    } catch { toast("You seem to be offline.", { tone: "err" }); } finally { setBusy(false); }
  }

  async function forget(id?: string) {
    if (!id && !confirm("Erase everything Riya remembers about you? Your trips and bookings stay as they are.")) return;
    const r = await fetch(`/api/profile${id ? `?note=${encodeURIComponent(id)}` : ""}`, { method: "DELETE" });
    if (!r.ok) return toast("That didn't work. Try again.", { tone: "err" });
    const j = await r.json();
    setP(j.prefs); setNotes(j.notes); setDirty(false);
    toast(id ? "Forgotten." : "Done. Riya has forgotten everything.", { tone: "ok" });
  }

  return (
    <div className="mem">
      {empty && (
        <div className="panel mem-empty">
          <b>Riya doesn&apos;t know much about you yet.</b>
          <p>Fill in a few things below, or just chat. Riya picks up preferences as you talk (&ldquo;we&apos;re vegetarian&rdquo;, &ldquo;no early flights&rdquo;).</p>
          <button className="btn hot" onClick={() => askRiya("Ask me a few quick questions so you can learn how I like to travel.")}>Let Riya ask me</button>
        </div>
      )}

      <section className="panel">
        <h2>How you travel</h2>
        <div className="mem-row"><span>Usually with</span><Chips all={TRAVELS_WITH} on={p.travelsWith ? [p.travelsWith] : []} toggle={(v) => upd({ travelsWith: p.travelsWith === v ? null : v })} show={(v) => v[0].toUpperCase() + v.slice(1)} /></div>
        <div className="mem-row"><span>Trips you love</span><Chips all={LIKES as never[]} on={(p.likes ?? []) as never[]} toggle={toggle("likes") as never} show={label} /></div>
        <div className="mem-row"><span>Favourite regions</span><Chips all={REGIONS} on={p.regions ?? []} toggle={toggle("regions")} /></div>
        <div className="mem-row"><span>Best months</span><Chips all={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} on={p.months ?? []} toggle={toggle("months")} show={(m) => monthName(m)} /></div>
        <div className="mem-row"><span>Pace</span><Chips all={PACES} on={p.pace ? [p.pace] : []} toggle={(v) => upd({ pace: p.pace === v ? null : v })} show={(v) => v[0].toUpperCase() + v.slice(1)} /></div>
        <div className="mem-row">
          <label htmlFor="mem-budget">Budget per adult</label>
          <div className="mem-inline"><span>₹</span><input id="mem-budget" className="in" inputMode="numeric" placeholder="e.g. 150000" value={p.budgetPerAdult ?? ""} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); upd({ budgetPerAdult: n >= 5000 ? Math.min(n, 2_000_000) : null }); }} /></div>
        </div>
        <div className="mem-row">
          <label htmlFor="mem-food">Food</label>
          <input id="mem-food" className="in" maxLength={60} placeholder="e.g. vegetarian, Jain, no seafood" value={p.dietary ?? ""} onChange={(e) => upd({ dietary: e.target.value || null })} />
        </div>
        <div className="mem-row">
          <span>Avoid</span>
          <div>
            <div className="mem-chips">{(p.avoid ?? []).map((a) => <span key={a} className="mem-chip on">{a}<button type="button" aria-label={`Remove ${a}`} onClick={() => upd({ avoid: (p.avoid ?? []).filter((x) => x !== a) })}>×</button></span>)}</div>
            <form className="mem-inline" onSubmit={(e) => { e.preventDefault(); const v = avoid.trim(); if (v && !(p.avoid ?? []).includes(v)) upd({ avoid: [...(p.avoid ?? []), v].slice(0, 8) }); setAvoid(""); }}>
              <input className="in" maxLength={40} placeholder="e.g. long flights, cold weather" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
              <button className="btn sm">Add</button>
            </form>
          </div>
        </div>
        <div className="mem-save">
          <button className="btn hot" disabled={busy || !dirty} onClick={() => save()}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
        </div>
      </section>

      <section className="panel">
        <h2>Notes Riya has kept</h2>
        {notes.length === 0 ? <p className="muted">Nothing yet. Riya adds short notes when you mention something worth remembering, like an anniversary or a seat preference.</p> : (
          <ul className="mem-notes">
            {notes.map((n) => (
              <li key={n.id}><span>{n.text}</span><small>{new Date(n.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small><button className="link-btn" onClick={() => forget(n.id)}>Forget</button></li>
            ))}
          </ul>
        )}
        <form className="mem-inline" onSubmit={(e) => { e.preventDefault(); if (note.trim()) save(note.trim()); }}>
          <input className="in" maxLength={160} placeholder="Add a note, e.g. prefer aisle seats" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn sm" disabled={busy || !note.trim()}>Add</button>
        </form>
      </section>

      {!empty && (
        <p className="mem-forget"><button className="link-btn danger" onClick={() => forget()}>Erase everything Riya knows about me</button></p>
      )}
    </div>
  );
}
