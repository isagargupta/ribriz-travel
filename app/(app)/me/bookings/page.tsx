import type { Metadata } from "next";
import Link from "next/link";
import AskButton from "@/components/me/AskButton";
import { myDashboard } from "@/lib/dashboard";
import { fmt, fmtDate } from "@/lib/pricing";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };
const ICON: Record<string, string> = { Flights: "✈️", Hotel: "🏨", "Travel insurance": "🛡️", Forex: "💱", "Visa service": "🛂" };
const REQ: Record<string, string> = { hold: "Price hold", enquiry: "Question", custom: "Custom trip", visa: "Visa", forex: "Forex", insurance: "Insurance", flight: "Flights", hotel: "Hotel" };
const REQ_ICON: Record<string, string> = { hold: "🔒", enquiry: "💬", custom: "🗺️", visa: "🛂", forex: "💱", insurance: "🛡️", flight: "✈️", hotel: "🏨" };
const STATUS: Record<string, string> = { new: "Received", contacted: "In progress", booked: "Booked", closed: "Closed" };

export default async function Bookings() {
  const { d } = (await myDashboard())!;
  return (
    <div className="wrap">
      <div className="app-page-head"><div><h1>Bookings</h1><p>Everything confirmed, with reference numbers, and every request you&apos;ve made.</p></div></div>
      <section className="app-sec">
        <h2>Confirmed and in progress</h2>
        {d.bookings.length === 0 ? (
          <div className="app-empty"><b>Nothing booked yet</b><p>When you choose a flight, hotel, insurance plan or forex option, it appears here with its confirmation number.</p><AskButton className="btn" q="What can you book for my trip?">Ask Riya what to book</AskButton></div>
        ) : (
          <div className="app-list">
            {d.bookings.map((b, i) => (
              <div key={b.id} className="app-row" style={{ ["--i" as string]: i }}>
                <span className="ar-ico">{ICON[b.label] ?? "🎟️"}</span>
                <span className="ar-main"><small>{b.label} · {b.status === "booked" ? "Confirmed" : "Booking in progress"}</small><b>{b.title}</b></span>
                {b.confirmation ? <code title="Confirmation number">{b.confirmation}</code> : <span className="muted">Confirmation soon</span>}
                {b.tripId && <Link className="btn sm" href={`/me/trips/${b.tripId}`}>Trip</Link>}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="app-sec">
        <h2>Your requests</h2>
        {d.requests.length === 0 ? <p className="muted">None yet.</p> : (
          <div className="app-list">
            {d.requests.map((r, i) => (
              <div key={r.ref} className="app-row" style={{ ["--i" as string]: i }}>
                <span className="ar-ico">{REQ_ICON[r.type] ?? "📄"}</span>
                <span className="ar-main"><small>{REQ[r.type] ?? r.type} · {r.ref} · {fmtDate(r.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</small><b>{r.title ?? REQ[r.type]}</b></span>
                {r.total ? <span className="mono">{fmt(r.total)}</span> : null}
                <span className={`status ${r.status}`}>{STATUS[r.status] ?? r.status}</span>
                {d.dues.find((x) => x.ref === r.ref) ? <Link className="btn sm hot" href={d.dues.find((x) => x.ref === r.ref)!.payPath}>Pay {fmt(d.dues.find((x) => x.ref === r.ref)!.amount)}</Link> : <Link className="btn sm" href={`/booking?ref=${r.ref}`}>Details</Link>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
