"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global { interface Window { __ribrizInstall?: InstallEvent | null } }

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const HIDE = "ribriz-phone-setup-hidden";

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registers the service worker and keeps the browser's "install app" offer for later. Mounted once in the app shell. */
export function PwaBoot() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const keep = (e: Event) => { e.preventDefault(); window.__ribrizInstall = e as InstallEvent; window.dispatchEvent(new Event("ribriz:installable")); };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);
  return null;
}

/** Clears this device's offline copies before signing out, so the next person can't see them. */
export async function forgetDevice() {
  try {
    await Promise.all(["ribriz-pages-v1", "ribriz-wallet"].map((k) => caches.delete(k)));
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* nothing cached */ }
}

/**
 * "Get Riya on your phone": install the app and turn on notifications.
 * iPhones only allow notifications once the app is on the Home Screen, so
 * there it explains how to add it first.
 */
export default function PhoneSetup({ variant = "tile" }: { variant?: "tile" | "row" }) {
  const [state, setState] = useState<{ standalone: boolean; ios: boolean; push: boolean; perm: NotificationPermission | "unsupported"; on: boolean; installable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const read = async () => {
      const push = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!KEY;
      let on = false;
      if (push) { const reg = await navigator.serviceWorker.getRegistration(); on = !!(await reg?.pushManager.getSubscription()); }
      setState({
        standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
        ios: /iPhone|iPad|iPod/.test(navigator.userAgent), push, perm: push ? Notification.permission : "unsupported", on, installable: !!window.__ribrizInstall,
      });
    };
    read();
    try { setHidden(variant === "tile" && localStorage.getItem(HIDE) === "1"); } catch { /* private mode */ }
    const onInstallable = () => setState((s) => (s ? { ...s, installable: true } : s));
    window.addEventListener("ribriz:installable", onInstallable);
    return () => window.removeEventListener("ribriz:installable", onInstallable);
  }, [variant]);

  if (!state || hidden) return null;
  const done = state.on && (state.standalone || !state.ios);
  if (variant === "tile" && done) return null;

  async function install() {
    const e = window.__ribrizInstall;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__ribrizInstall = null;
    setState((s) => (s ? { ...s, installable: false, standalone: outcome === "accepted" || s.standalone } : s));
  }

  async function turnOn() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState((s) => (s ? { ...s, perm } : s)); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn't turn them on.");
      setState((s) => (s ? { ...s, perm, on: true } : s));
      setMsg("Done. You should see a test notification now.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't turn them on."); }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState((s) => (s ? { ...s, on: false } : s));
    setBusy(false);
  }

  const iosNeedsInstall = state.ios && !state.standalone;
  return (
    <div className={variant === "tile" ? "panel me-tile phone-setup" : "phone-setup row"}>
      {variant === "tile" && <button type="button" className="ps-x" aria-label="Hide" onClick={() => { setHidden(true); try { localStorage.setItem(HIDE, "1"); } catch { /* private mode */ } }}>✕</button>}
      <h2>📲 Riya on your phone</h2>
      {iosNeedsInstall ? (
        <>
          <p className="muted">Add Ribriz to your Home Screen to get trip alerts and open your wallet offline.</p>
          <ol className="ps-steps"><li>Tap <b>Share</b> <span aria-hidden="true">⬆︎</span> in Safari</li><li>Choose <b>Add to Home Screen</b></li><li>Open Ribriz from your Home Screen and turn on notifications here</li></ol>
        </>
      ) : (
        <>
          <p className="muted">{state.on ? "Notifications are on for this device." : "Get a ping when something needs your OK, a price drops, your visa moves, plus your plan each morning of the trip."}</p>
          <div className="ps-acts">
            {state.installable && !state.standalone && <button type="button" className="btn sm" onClick={install}>Install app</button>}
            {!state.push ? <small className="muted">This browser can&apos;t show notifications.</small>
              : state.perm === "denied" ? <small className="warn-txt">Notifications are blocked. Allow them for ribriztravel.com in your browser settings.</small>
              : state.on ? <button type="button" className="link-btn" disabled={busy} onClick={turnOff}>Turn off on this device</button>
              : <button type="button" className="btn hot sm" disabled={busy} onClick={turnOn}>{busy ? "Turning on…" : "Turn on notifications"}</button>}
          </div>
        </>
      )}
      {msg && <p className="ps-msg" role="status">{msg}</p>}
    </div>
  );
}
