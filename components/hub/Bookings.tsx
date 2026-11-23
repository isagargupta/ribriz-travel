import type { BookingView } from "@/lib/offers";
import { fmt } from "@/lib/pricing";

const ICON: Record<string, string> = { flight: "✈", hotel: "🏨", insurance: "🛡", forex: "💱", visa: "🛂" };

/** Everything booked for the trip, with confirmation numbers: the traveller's travel pack. */
export default function Bookings({ items }: { items: BookingView[] }) {
  if (!items.length) return null;
  return (
    <section className="panel bookings">
      <h2>Your bookings</h2>
      <ul>
        {items.map((b) => (
          <li key={b.id} className={`bk-${b.status}`}>
            <span className="bk-ico" aria-hidden="true">{ICON[b.service] ?? "•"}</span>
            <div>
              <small>{b.label} · {b.status === "booked" ? "Confirmed" : "Booking in progress"}</small>
              <b>{b.title}</b>
              {b.lines.length > 0 && <p>{b.lines.join(" · ")}</p>}
            </div>
            <div className="bk-right">
              {b.priceInr ? <span className="mono">{fmt(b.priceInr)}</span> : null}
              {b.confirmation ? <span className="bk-conf" title="Confirmation number">{b.confirmation}</span> : <span className="muted">Confirmation soon</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
