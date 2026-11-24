"use client";
import { useState } from "react";
import { announceChange } from "../assistant/Assistant";

export default function StopWatch({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="link-btn" disabled={busy} onClick={async () => { setBusy(true); await fetch(`/api/price-watch?id=${encodeURIComponent(id)}`, { method: "DELETE" }); announceChange(); }}>
      {busy ? "Stopping…" : "Stop"}
    </button>
  );
}
