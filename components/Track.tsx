"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track, type TrackType } from "@/lib/client/track";

/** Counts page views for the funnel (mounted once in the root layout). */
export default function Track() {
  const path = usePathname();
  const q = useSearchParams()?.get("q");
  useEffect(() => { track("page_view", { path: path + (path === "/trips" && q ? `?q=${q}` : "") }); }, [path, q]);
  return null;
}

/** Records one event when a page or component shows, e.g. the pay page. */
export function TrackView({ type, tripId, refCode }: { type: TrackType; tripId?: string; refCode?: string }) {
  useEffect(() => { track(type, { tripId, ref: refCode }); }, [type, tripId, refCode]);
  return null;
}
