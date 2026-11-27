"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveStaffAction, type StaffFormState } from "@/app/admin/actions";

export interface StaffRow { id: string; name: string; email: string; role: string; active: boolean; takesNew: boolean }

/** Owner: add an employee, or change one's role and access. */
export default function StaffForm({ s }: { s?: StaffRow }) {
  const [state, act, busy] = useActionState<StaffFormState, FormData>(saveStaffAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && !s) form.current?.reset(); }, [state, s]);
  return (
    <form ref={form} action={act} className="dk-inline dk-staff-form">
      {s && <input type="hidden" name="id" value={s.id} />}
      <input className="dk-in" name="name" defaultValue={s?.name} placeholder="Full name" required aria-label="Name" />
      {!s && <input className="dk-in" name="email" type="email" placeholder="work@email.com" required aria-label="Email" />}
      <select className="dk-in" name="role" defaultValue={s?.role ?? "agent"} aria-label="Role">
        <option value="agent">Agent</option><option value="manager">Manager</option><option value="owner">Owner</option>
      </select>
      <label className="dk-meta"><input type="checkbox" name="takesNew" defaultChecked={s?.takesNew ?? true} /> Gets new clients</label>
      {s && <label className="dk-meta"><input type="checkbox" name="active" defaultChecked={s.active} /> Active</label>}
      {!s && <input type="hidden" name="active" value="on" />}
      <button className={`dk-btn ${s ? "" : "primary"}`} disabled={busy}>{busy ? "Saving…" : s ? "Save" : "Add employee"}</button>
      {state?.ok && <small className="ok-txt" role="status">✓ {s ? "Saved" : "Added. We emailed them how to sign in."}</small>}
      {state?.error && <small className="warn-txt" role="alert">{state.error}</small>}
    </form>
  );
}
