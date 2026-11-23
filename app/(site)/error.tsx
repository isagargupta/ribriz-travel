"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="login-card" style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: 24 }}>Something went wrong on our side</h1>
      <p className="muted" style={{ margin: 0 }}>Please try again. If it keeps happening, call us and we&apos;ll help you book by phone.</p>
      <button className="btn hot" onClick={reset}>Try again</button>
      <Link className="btn" href="/">Go to home page</Link>
      {error.digest && <small className="muted mono">Error code {error.digest}</small>}
    </div>
  );
}
