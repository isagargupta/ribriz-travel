"use client";
import { useActionState } from "react";
import { login } from "@/app/admin/actions";

export default function PasswordLogin() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="otp-card" style={{ boxShadow: "none" }}>
      <label className="lab">Admin password
        <input className="in big" type="password" name="password" required autoComplete="current-password" />
      </label>
      {state?.error && <div className="notice err" role="alert">{state.error}</div>}
      <button className="btn primary block" disabled={pending}>{pending ? <span className="spinner" aria-label="Checking" /> : "Sign in with password"}</button>
    </form>
  );
}
