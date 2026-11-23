"use client";
import { useState } from "react";
import { askRiya } from "../assistant/Assistant";

const IDEAS = ["Plan a beach trip under ₹1 lakh", "Do I need a visa for Japan?", "Best deals this month", "Get forex for my trip", "Somewhere cool in May"];

/** Tell Riya anything; she takes it from there. */
export default function CommandBar() {
  const [q, setQ] = useState("");
  return (
    <div className="cmd">
      <form className="cmd-bar" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { askRiya(q.trim()); setQ(""); } }}>
        <span className="cmd-spark" aria-hidden="true">✦</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tell Riya what you want… “a relaxed week in Bali in March”" aria-label="Ask Riya" />
        <button className="btn hot" disabled={!q.trim()}>Go</button>
      </form>
      <div className="cmd-ideas">{IDEAS.map((i) => <button key={i} type="button" onClick={() => askRiya(i)}>{i}</button>)}</div>
    </div>
  );
}
