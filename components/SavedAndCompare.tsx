"use client";
import Image from "next/image";
import Link from "next/link";
import type { TripDTO } from "@/lib/types";
import { BOARDS, fmtDate, quote } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import TripCard from "./TripCard";

export function SavedTrips({ trips }: { trips: TripDTO[] }) {
  const { saved, ready } = usePrefs();
  if (!ready) return <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="card skel" />)}</div>;
  const list = saved.map((id) => trips.find((t) => t.id === id)).filter((t): t is TripDTO => !!t);
  if (!list.length)
    return (
      <div className="empty">
        <h3>No saved trips yet</h3>
        <p>Tap the ♥ on any trip to keep it here. Saved trips stay on this device.</p>
        <Link className="btn primary" href="/trips">Browse trips</Link>
      </div>
    );
  return <div className="grid stagger">{list.map((t) => <TripCard key={t.id} t={t} />)}</div>;
}

type Val = number | string;
type Row = { label: string; get: (t: TripDTO) => Val; best?: "min" | "max"; show: (v: Val) => React.ReactNode };

export function CompareTable({ trips }: { trips: TripDTO[] }) {
  const { compare, toggleCompare, money, from, adults, childAges, ready } = usePrefs();
  if (!ready) return <div className="card skel" style={{ height: 420 }} />;
  const ts = compare.map((id) => trips.find((t) => t.id === id)).filter((t): t is TripDTO => !!t);
  const people = adults + childAges.length;

  if (ts.length < 2)
    return (
      <div className="empty">
        <h3>Pick at least two trips</h3>
        <p>Tick “Compare” on up to three trips, then come back here.</p>
        <Link className="btn primary" href="/trips">Browse trips</Link>
      </div>
    );

  const q = (t: TripDTO) => quote({ base: t.price, delta: t.minDelta, flight: t.flight, from, adults, childAges });
  const m = (v: Val) => money(Number(v));
  const yes = (v: Val) => (v === "Yes" ? <span className="yes">✓ Yes</span> : <span className="muted">No</span>);
  const rows: Row[] = [
    { label: "From, per adult", get: (t) => q(t).perAdult, best: "min", show: m },
    { label: `Total for ${people} incl. GST`, get: (t) => q(t).total, best: "min", show: m },
    { label: "Per night, per adult", get: (t) => Math.round(q(t).perAdult / t.nights), best: "min", show: m },
    { label: "Cheapest date", get: (t) => (t.cheapestDate ? fmtDate(t.cheapestDate) : "On request"), show: String },
    { label: "Nights", get: (t) => t.nights, show: String },
    { label: "Guest rating", get: (t) => t.rating, best: "max", show: (v) => Number(v).toFixed(1) },
    { label: "Hotel", get: (t) => t.stars, best: "max", show: (v) => "★".repeat(Number(v)) },
    { label: "Meals", get: (t) => BOARDS[t.board] ?? t.board, show: String },
    { label: "Flights included", get: (t) => (t.flight ? "Yes" : "No"), show: yes },
    { label: "Tour manager", get: (t) => (t.tourManager ? "Yes" : "No"), show: yes },
    { label: "Free cancellation", get: (t) => (t.freeCancel ? "Yes" : "No"), show: yes },
    { label: "To the beach", get: (t) => (t.beach === null ? "—" : t.beach === 0 ? "On the beach" : `${t.beach} m`), show: String },
  ];

  return (
    <div className="table-wrap">
      <table className="cmp-table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Detail</span></th>
            {ts.map((t) => (
              <th scope="col" key={t.id}>
                <span className="cmp-img"><Image src={t.image} alt="" fill sizes="240px" /></span>
                <b>{t.dest}</b>
                <small>{t.title}</small>
                <button className="link-btn" onClick={() => toggleCompare(t.id)}>Remove</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vals = ts.map(r.get);
            const nums = vals.filter((v): v is number => typeof v === "number");
            const b = r.best === "min" ? Math.min(...nums) : r.best === "max" ? Math.max(...nums) : null;
            return (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {vals.map((v, i) => <td key={ts[i].id} className={`${b !== null && v === b ? "best" : ""} ${typeof v === "number" ? "mono" : ""}`}>{r.show(v)}{b !== null && v === b && <span className="best-tag">Best</span>}</td>)}
              </tr>
            );
          })}
          <tr><th scope="row" />{ts.map((t) => <td key={t.id}><Link className="btn hot sm" href={`/trips/${t.slug}`}>See dates</Link></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
