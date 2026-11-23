"use client";
import { useState } from "react";

/** A button, not a GET link: mail scanners that open links can't unsubscribe anyone. */
export default function UnsubscribeButton({ e, s }: { e: string; s: string }) {
  const [state, setState] = useState<"idle" | "busy" | "off" | "on" | "error">("idle");
  async function go(undo: boolean) {
    setState("busy");
    const r = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ e, s, undo }) }).catch(() => null);
    setState(r?.ok ? (undo ? "on" : "off") : "error");
  }
  if (state === "off") return <div className="notice ok" role="status">Done. Riya won&apos;t email trip updates any more. <button className="link-btn" onClick={() => go(true)}>Undo</button></div>;
  if (state === "on") return <div className="notice ok" role="status">You&apos;re back on. Riya will email you when something changes.</div>;
  return (
    <>
      <button className="btn hot" disabled={state === "busy"} onClick={() => go(false)}>{state === "busy" ? "One moment…" : "Stop trip update emails"}</button>
      {state === "error" && <p className="notice warn">That didn&apos;t work. Please try again.</p>}
    </>
  );
}
