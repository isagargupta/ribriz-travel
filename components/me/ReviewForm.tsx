"use client";
import { useState } from "react";
import { announceChange } from "../assistant/Assistant";

/** "How was it?" for a trip the traveller has taken. Shown with the name they choose. */
export default function ReviewForm({ missionId, dest, defaultName }: { missionId: string; dest: string; defaultName: string }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const words = ["", "Poor", "Okay", "Good", "Great", "Amazing"];

  async function send() {
    setState("busy"); setErr(null);
    const r = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missionId, stars, title: title || undefined, body, displayName: name }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setState("idle"); setErr(j.error || "That didn't work. Please try again."); return; }
    setState("done");
    setTimeout(announceChange, 1800);
  }

  if (state === "done") return <div className="rvf done" role="status"><span className="rvf-big">💛</span><b>Thank you!</b><p>Your review of {dest} will appear on the trip page once our team has checked it, exactly as you wrote it.</p></div>;
  return (
    <div className="rvf" id={`review-${missionId}`}>
      <b>How was {dest}?</b>
      <div className="rvf-stars" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={(hover || stars) >= n ? "on" : ""} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)}>★</button>
        ))}
        <span className="rvf-word">{words[hover || stars]}</span>
      </div>
      {stars > 0 && (
        <div className="rvf-more">
          <input className="in" maxLength={80} placeholder="Sum it up in a few words (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="in" rows={4} maxLength={2000} placeholder="What did you love? What could be better? Hotels, guide, food, transfers…" value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="fine">Shown as <input className="in rvf-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <p className="fine">We publish reviews as written, good or bad, after checking they're about the trip. See our <a href="/legal/privacy">privacy policy</a>.</p>
          {err && <p className="appr-err" role="alert">{err}</p>}
          <button className="btn hot" disabled={state === "busy" || body.trim().length < 20 || name.trim().length < 2} onClick={send}>{state === "busy" ? "Sending…" : "Post review"}</button>
        </div>
      )}
    </div>
  );
}
