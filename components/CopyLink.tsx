"use client";
import { useState } from "react";

/** Copies a link (made absolute) to the clipboard, or opens the phone's share sheet when available. */
export default function CopyLink({ path, label, title }: { path: string; label: string; title?: string }) {
  const [done, setDone] = useState(false);
  async function go() {
    const url = new URL(path, location.origin).href;
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) await navigator.share({ title: title ?? "Ribriz Travel", url });
      else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2500); }
    } catch { /* cancelled */ }
  }
  return <button type="button" className="btn sm" onClick={go}>{done ? "✓ Link copied" : label}</button>;
}
