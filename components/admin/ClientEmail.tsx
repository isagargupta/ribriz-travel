"use client";
import { useActionState, useEffect, useRef } from "react";
import { emailClientAction, type ClientMailState } from "@/app/admin/actions";

/** Write to the client from their page; replies come back to the employee who sent it. */
export default function ClientEmail({ email, name }: { email: string; name: string }) {
  const [state, act, busy] = useActionState<ClientMailState, FormData>(emailClientAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={act} className="dk-form" id="email">
      <input type="hidden" name="email" value={email} />
      <input className="dk-in" name="subject" placeholder="Subject" required />
      <textarea name="body" placeholder={`Hi ${name.split(" ")[0]},`} required rows={5} />
      <div className="dk-inline" style={{ justifyContent: "space-between" }}>
        <small className="dk-meta">Replies come straight to your inbox.</small>
        <button className="dk-btn primary" disabled={busy}>{busy ? "Sending…" : "Send email"}</button>
      </div>
      {state?.ok && <small className="ok-txt" role="status">✓ Sent and saved to the client&apos;s history.</small>}
      {state?.error && <small className="warn-txt" role="alert">{state.error}</small>}
    </form>
  );
}
