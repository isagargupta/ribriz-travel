"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="login-card">
      <img src="/img/logo.png" alt="Ribriz Travel" style={{ height: 52 }} />
      <h1 style={{ fontSize: 24 }}>Admin sign in</h1>
      <label className="lab">Password
        <input className="in" type="password" name="password" required autoFocus autoComplete="current-password" />
      </label>
      {state?.error && <div className="notice err">{state.error}</div>}
      <button className="btn hot" type="submit" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
      <a className="muted" href="/" style={{ fontSize: 13, textAlign: "center" }}>← Back to site</a>
    </form>
  );
}
