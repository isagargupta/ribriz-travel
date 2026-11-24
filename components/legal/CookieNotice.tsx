"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ribriz_cookie_notice_v1";

/** We only use essential cookies, so this informs rather than asks; shown once per browser. */
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem(KEY)); } catch { /* storage blocked: skip */ } }, []);
  if (!show) return null;
  const ok = () => { try { localStorage.setItem(KEY, "1"); } catch {} setShow(false); };
  return (
    <div className="cookie-note" role="region" aria-label="Cookie notice">
      <p>We use only essential cookies to keep you signed in and remember your trips. No ads, no tracking. <Link href="/legal/cookies">Details</Link></p>
      <button className="btn sm" onClick={ok}>OK</button>
    </div>
  );
}
