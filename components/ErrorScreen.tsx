"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page crashes. The team is told automatically (no customer details are sent). */
export default function ErrorScreen({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => {
    console.error(error);
    const body = JSON.stringify({ message: error.message || "Unknown error", path: location.pathname + location.search, digest: error.digest ?? null });
    try { navigator.sendBeacon?.("/api/report", new Blob([body], { type: "application/json" })) || fetch("/api/report", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }); } catch { /* ignore */ }
  }, [error]);
  return (
    <div className="login-card" style={{ textAlign: "center", margin: "40px auto" }}>
      <h1 style={{ fontSize: 24 }}>Something went wrong on our side</h1>
      <p className="muted" style={{ margin: 0 }}>We&apos;ve been told automatically and are looking at it. Please try again, or ask Riya and she&apos;ll help you book.</p>
      <button className="btn hot" onClick={reset}>Try again</button>
      <Link className="btn" href={home}>Go back home</Link>
      {error.digest && <small className="muted mono">Error code {error.digest}</small>}
    </div>
  );
}
