"use client";
import { useActionState, useState } from "react";
import { markBookedAction, sendOffersAction, type OfferFormState } from "@/app/admin/actions";

export interface AdminOffer { id: string; title: string; lines: string[]; priceInr: number | null; status: string; confirmation: string | null; validUntil: string }

const STATUS: Record<string, string> = { offered: "Waiting for traveller", chosen: "Chosen: book it", declined: "Passed", expired: "Expired", booked: "Booked", cancelled: "Cancelled" };
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/** Team side of a service request: send up to 3 options, then record the booking. */
export default function OffersPanel({ enquiryId, offers, canSend, hint }: { enquiryId: string; offers: AdminOffer[]; canSend: boolean; hint?: string | null }) {
  const [sendState, send, sending] = useActionState<OfferFormState, FormData>(sendOffersAction, undefined);
  const [bookState, book, booking] = useActionState<OfferFormState, FormData>(markBookedAction, undefined);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(2);
  const chosen = offers.find((o) => o.status === "chosen" || o.status === "booked");

  return (
    <div className="offers-admin">
      {offers.length > 0 && (
        <ul className="oa-list">
          {offers.map((o) => (
            <li key={o.id} className={`oa-${o.status}`}>
              <div><b>{o.title}</b>{o.priceInr ? <span className="mono"> · {inr(o.priceInr)}</span> : null}<span className={`pill oa-st`}>{STATUS[o.status] ?? o.status}</span></div>
              {o.lines.length > 0 && <small className="muted">{o.lines.join(" · ")}</small>}
              {o.confirmation && <small style={{ display: "block" }}>Confirmation <b className="mono">{o.confirmation}</b></small>}
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <form action={book} className="oa-book">
          <input type="hidden" name="offerId" value={chosen.id} />
          <label className="lab" style={{ flex: 1 }}>{chosen.status === "booked" ? "Update booking reference" : "Booked with the supplier? Add the reference"}
            <input className="in" name="confirmation" required defaultValue={chosen.confirmation ?? ""} placeholder="PNR, policy, voucher or order number" />
          </label>
          <button className="btn blue" disabled={booking}>{booking ? "Saving…" : chosen.status === "booked" ? "Update" : "Mark booked"}</button>
          {bookState?.error && <p className="appr-err" role="alert">{bookState.error}</p>}
          {bookState?.ok && <p className="notice ok" role="status">{bookState.ok}</p>}
        </form>
      )}

      {canSend && !chosen && (
        !open ? <button className="btn sm" onClick={() => setOpen(true)}>{offers.length ? "Send new options" : "Send options to traveller"}</button> : (
          <form action={send} className="oa-form">
            <input type="hidden" name="enquiryId" value={enquiryId} />
            {hint && <p className="fine">{hint}</p>}
            {Array.from({ length: count }, (_, i) => (
              <fieldset key={i}>
                <legend>Option {i + 1}</legend>
                <div className="oa-row">
                  <input className="in" name={`title${i}`} required={i === 0} placeholder="Title, e.g. IndiGo non-stop, 06:10 → 14:25" />
                  <input className="in" name={`price${i}`} inputMode="numeric" placeholder="Total ₹" style={{ width: 130 }} />
                </div>
                <textarea className="in" name={`lines${i}`} rows={2} placeholder={"One detail per line, e.g.\nCheck-in bag 23 kg · free date change"} />
              </fieldset>
            ))}
            <div className="oa-row" style={{ alignItems: "center" }}>
              {count < 3 && <button type="button" className="link-btn" onClick={() => setCount(count + 1)}>+ Add option</button>}
              <label className="lab" style={{ marginLeft: "auto" }}>Valid for
                <select className="in" name="validHours" defaultValue="24" style={{ width: 120 }}><option value="6">6 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">3 days</option></select>
              </label>
              <label className="chk" style={{ fontSize: 13 }}><input type="checkbox" name="notify" defaultChecked /> Email traveller</label>
              <button className="btn blue" disabled={sending}>{sending ? "Sending…" : "Send options"}</button>
            </div>
            {sendState?.error && <p className="appr-err" role="alert">{sendState.error}</p>}
          </form>
        )
      )}
      {sendState?.ok && <p className="notice ok" role="status">{sendState.ok}</p>}
    </div>
  );
}
