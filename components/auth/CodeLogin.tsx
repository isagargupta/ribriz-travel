"use client";
import { useEffect, useRef, useState } from "react";
import Consent from "@/components/legal/Consent";

type Result = { ok: boolean; error?: string; retryIn?: number; redirect?: string };

interface Props {
  request: (email: string) => Promise<Result>;
  verify: (email: string, code: string, next?: string) => Promise<Result>;
  next?: string;
  /** shown above the email box */
  intro?: React.ReactNode;
  defaultEmail?: string;
}

/** Two-step email + 6-digit code sign-in. Works for customers and the admin. */
export default function CodeLogin({ request, verify, next, intro, defaultEmail = "" }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr(null);
    const r = await request(email).catch(() => ({ ok: false, error: "Something went wrong. Please check your connection and try again." } as Result));
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Something went wrong."); if (r.retryIn) setWait(r.retryIn); return; }
    setStep("code"); setDigits(Array(6).fill("")); setWait(30);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  async function check(code: string) {
    setBusy(true); setErr(null);
    const r = await verify(email, code, next).catch(() => ({ ok: false, error: "Something went wrong. Please check your connection and try again." } as Result));
    // full page load so every part of the site (header, checkout) sees the new session
    if (r.ok) { window.location.assign(r.redirect || next || "/"); return; }
    setBusy(false);
    setErr(r.error ?? "That code didn't work.");
    setDigits(Array(6).fill(""));
    setTimeout(() => boxes.current[0]?.focus(), 30);
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) { // pasted or autofilled the whole code
      const all = clean.slice(0, 6).split("");
      const next = Array(6).fill("").map((_, k) => all[k] ?? "");
      setDigits(next);
      if (all.length === 6) check(all.join(""));
      else boxes.current[all.length]?.focus();
      return;
    }
    const next = [...digits]; next[i] = clean; setDigits(next);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) check(next.join(""));
  }

  if (step === "email") {
    return (
      <form className="otp-card pop-in" onSubmit={send}>
        {intro}
        <label className="lab">Email address
          <input className="in big" type="email" required autoFocus autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        {err && <div className="notice err" role="alert">{err}</div>}
        <button className="btn hot block lg" disabled={busy || wait > 0}>{busy ? <span className="spinner" aria-label="Sending" /> : wait > 0 ? `Try again in ${wait}s` : "Email me a code"}</button>
        <Consent action="signing in" />
        <p className="fine center">No password needed. We&apos;ll send a 6-digit code that works for 10 minutes.</p>
      </form>
    );
  }

  return (
    <div className="otp-card pop-in">
      <p style={{ margin: 0 }}>We sent a 6-digit code to <b>{email}</b>. It can take a minute to arrive; check spam if you don&apos;t see it.</p>
      <div className="otp-boxes" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => { boxes.current[i] = el; }} className="otp-box" value={d} disabled={busy}
            inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={i === 0 ? 6 : 1} aria-label={`Digit ${i + 1}`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
            }}
            onPaste={(e) => { e.preventDefault(); setDigit(0, e.clipboardData.getData("text")); }} />
        ))}
      </div>
      {busy && <p className="fine center"><span className="spinner dark" aria-label="Checking" /> Checking…</p>}
      {err && <div className="notice err" role="alert">{err}</div>}
      <div className="otp-links">
        <button className="link-btn" onClick={() => { setStep("email"); setErr(null); }}>Use a different email</button>
        <button className="link-btn" disabled={wait > 0 || busy} onClick={() => send()}>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</button>
      </div>
    </div>
  );
}
