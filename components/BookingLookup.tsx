"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { lookupBooking, type LookupState } from "@/app/(site)/booking/actions";
import { addDays, fmtDate } from "@/lib/pricing";
import Money from "./ui/Money";

const STAGES = [
  { key: "new", label: "Request received", hint: "We have your details and price." },
  { key: "contacted", label: "Expert in touch", hint: "We've called or emailed to confirm flights and rooms." },
  { key: "booked", label: "Booked", hint: "Deposit paid. Your trip is confirmed." },
];

function useCountdown(iso: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  return left;
}

export default function BookingLookup({ initialRef }: { initialRef: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupBooking, undefined);
  const b = state?.booking;
  const left = useCountdown(b?.holdEndsAt ?? null);
  const stage = b ? (b.status === "closed" ? -1 : STAGES.findIndex((s) => s.key === b.status)) : 0;

  if (b) {
    const h = left !== null ? Math.floor(left / 3600e3) : 0, m = left !== null ? Math.floor((left % 3600e3) / 60e3) : 0;
    return (
      <div className="panel lookup-result pop-in">
        <div className="lr-head">
          <div><small className="muted">Reference</small><div className="ref static">{b.ref}</div></div>
          <span className={`status ${b.status}`}>{b.status === "new" ? "Received" : b.status}</span>
        </div>
        <p>Hi {b.name}, here&apos;s the latest on your {b.type === "hold" ? "price hold" : b.type === "custom" ? "custom trip request" : "question"}.</p>
        {b.tripTitle && (
          <div className="co-trip">
            {b.image && <span className="co-img"><Image src={b.image} alt="" fill sizes="96px" /></span>}
            <div>
              <b>{b.tripSlug ? <Link href={`/trips/${b.tripSlug}`}>{b.tripTitle}</Link> : b.tripTitle}</b>
              {b.departure && <small>{fmtDate(b.departure, { weekday: "short", day: "numeric", month: "short" })}{b.nights ? ` – ${fmtDate(addDays(b.departure, b.nights), { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>}
              <small>{b.adults} adult{b.adults > 1 ? "s" : ""}{b.children ? `, ${b.children} child${b.children > 1 ? "ren" : ""}` : ""}{b.fromCity ? ` · from ${b.fromCity}` : ""}</small>
            </div>
          </div>
        )}
        {b.total !== null && <div className="lr-total"><span>Price held</span><Money inr={b.total} className="price" /></div>}
        {b.holdEndsAt && b.status === "new" && left !== null && (
          <div className={`notice ${left > 0 ? "ok" : "warn"}`}>{left > 0 ? `Price held for another ${h} h ${m} min.` : "The 48-hour hold has ended. Call us and we'll check today's price."}</div>
        )}
        {stage >= 0 ? (
          <ol className="timeline">
            {STAGES.map((s, i) => <li key={s.key} className={i <= stage ? "done" : ""}><b>{s.label}</b><span>{s.hint}</span></li>)}
          </ol>
        ) : <div className="notice">This request is closed. Contact us if you'd like to reopen it.</div>}
        {/* full reload resets the form state */}
        <a className="btn" href="/booking">Look up another</a>
      </div>
    );
  }

  return (
    <form action={action} className="panel form-grid lookup">
      <label className="full">Booking reference<input name="ref" required defaultValue={initialRef} placeholder="RB-7K2Q9M" autoCapitalize="characters" className="mono" /></label>
      <label className="full">Email you used<input name="email" type="email" required autoComplete="email" /></label>
      {state?.error && <div className="notice err full" role="alert">{state.error}</div>}
      <button className="btn hot full" disabled={pending}>{pending ? <span className="spinner" aria-label="Searching" /> : "Find my booking"}</button>
    </form>
  );
}
