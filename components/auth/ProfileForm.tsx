"use client";
import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/(site)/account/actions";

export default function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="form-grid">
      <label>Full name<input name="name" defaultValue={name} autoComplete="name" placeholder="As on passport" /></label>
      <label>Mobile<input name="phone" defaultValue={phone} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>
      {state?.error && <div className="notice err full" role="alert">{state.error}</div>}
      {state?.ok && <div className="notice ok full">Saved. We&apos;ll fill these in for your next booking.</div>}
      <button className="btn primary" disabled={pending}>{pending ? <span className="spinner" aria-label="Saving" /> : "Save details"}</button>
    </form>
  );
}
