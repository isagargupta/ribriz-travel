"use client";
// Anonymous funnel events: a random id per browser tab (sessionStorage), no cookies,
// nothing personal. Sent with sendBeacon so it never slows the page.

const SID = "rb-sid", SRC = "rb-src";

function sid() {
  try {
    let s = sessionStorage.getItem(SID);
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(SID, s); }
    return s;
  } catch { return null; }
}

/** First-touch source for this visit: utm_source, else the referring site, else direct. */
function source() {
  try {
    let s = sessionStorage.getItem(SRC);
    if (!s) {
      const utm = new URLSearchParams(location.search).get("utm_source");
      const ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      s = (utm || (ref && !ref.endsWith("ribriztravel.com") && ref !== location.hostname ? ref : "direct")).slice(0, 60);
      sessionStorage.setItem(SRC, s);
    }
    return s;
  } catch { return "direct"; }
}

export type TrackType = "page_view" | "trip_view" | "hold_start" | "hold_created" | "pay_view" | "chat_open" | "chat_message" | "search";

export function track(type: TrackType, data: { tripId?: string; ref?: string; path?: string } = {}) {
  if (typeof window === "undefined" || navigator.webdriver && !(window as { __rbTrackTests?: boolean }).__rbTrackTests) return;
  const body = JSON.stringify({ type, sid: sid(), source: source(), device: matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop", path: data.path ?? location.pathname, tripId: data.tripId, ref: data.ref });
  try {
    if (!navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}
