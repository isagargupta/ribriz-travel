"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps the dashboard current while it's open: refreshes every 30 s, and on return to the tab. */
export default function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [router]);
  return <span className="live-dot" title="Live: updates as Riya works"><i /> Live</span>;
}
