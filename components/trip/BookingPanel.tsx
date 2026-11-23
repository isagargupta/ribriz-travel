"use client";
import { BOARDS, HOLD_HOURS, addDays, emi, fmtDate } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import PaxPicker from "../PaxPicker";
import Money from "../ui/Money";
import { useBooking } from "./BookingContext";

export default function BookingPanel() {
  const { trip, selected, q, setCheckout, setQuestion } = useBooking();
  const { saved, toggleSaved, toast, priceMode } = usePrefs();
  const wa = process.env.NEXT_PUBLIC_WHATSAPP;
  const on = saved.includes(trip.id);

  return (
    <div className="book-box">
      <div className="panel book">
        {q && selected ? (
          <>
            <div className="book-price">
              <Money inr={priceMode === "total" ? q.total : q.perAdult} className="price" />
              <span className="muted">{priceMode === "total" ? `total for ${q.travellers}, incl. GST` : "per adult, before GST"}</span>
            </div>
            <button className="date-chip" onClick={() => document.getElementById("dates")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <span>
                <small>Dates</small>
                <b>{fmtDate(selected.date, { day: "numeric", month: "short" })} – {fmtDate(addDays(selected.date, trip.nights), { day: "numeric", month: "short" })}</b>
              </span>
              <span className="link-btn">Change</span>
            </button>
            <PaxPicker className="field boxed" />
            {selected.seatsLeft !== null && selected.seatsLeft <= 8 && <div className="notice warn">Only {selected.seatsLeft} seats left on this date</div>}

            <table className="breakdown">
              <tbody>
                {q.lines.map((l) => <tr key={l.label}><td>{l.label}<small>{l.detail}</small></td><td><Money inr={l.amount} /></td></tr>)}
                <tr><td>GST 5%</td><td><Money inr={q.gst} /></td></tr>
                <tr className="total"><td>Total</td><td><Money inr={q.total} /></td></tr>
              </tbody>
            </table>
            <p className="fine">Includes {trip.flight ? "return flights, " : ""}{trip.nights} nights, {BOARDS[trip.board]?.toLowerCase()}, transfers and listed sightseeing. Or <b><Money inr={emi(q.total, 6)} />/month</b> for 6 months at 0% interest.</p>

            <button className="btn hot block lg" onClick={() => setCheckout(true)}>Reserve this price</button>
            <p className="fine center">Free {HOLD_HOURS}-hour hold · No payment today</p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 18 }}>Dates on request</h2>
            <p className="muted">There are no open dates online right now. Ask us and we&apos;ll find one that suits you.</p>
          </>
        )}
        <div className="book-alt">
          <button className="btn block" onClick={() => setQuestion(true)}>Ask a question</button>
          <button className="btn block" aria-pressed={on} onClick={() => toast(toggleSaved(trip.id) ? "Saved to your trips" : "Removed from saved trips", { tone: "ok" })}>
            {on ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
        {wa && (
          <a className="wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi Ribriz, I'm looking at "${trip.title}"${selected ? ` leaving ${selected.date}` : ""}.`)}`} target="_blank" rel="noopener noreferrer">
            Chat with an expert on WhatsApp
          </a>
        )}
        <ul className="assure">
          <li>{trip.freeCancel ? "Free cancellation until 30 days before you leave" : "Clear cancellation terms before you pay"}</li>
          <li>Price confirmed in writing within 2 hours</li>
          <li>24×7 help while you travel</li>
        </ul>
      </div>
    </div>
  );
}

/** Price bar pinned to the bottom of the screen on phones. */
export function StickyBookBar() {
  const { q, setCheckout, selected, trip } = useBooking();
  if (!q || !selected) return null;
  return (
    <div className="sticky-book">
      <div>
        <Money inr={q.total} className="price" />
        <small>{q.travellers} traveller{q.travellers > 1 ? "s" : ""} · {fmtDate(selected.date, { day: "numeric", month: "short" })} · {trip.nights}N</small>
      </div>
      <button className="btn hot" onClick={() => setCheckout(true)}>Reserve</button>
    </div>
  );
}
