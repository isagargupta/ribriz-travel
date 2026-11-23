"use client";
import Link from "next/link";
import type { TripDTO } from "@/lib/types";
import { BOARDS, fmt, groupTotal, ppPrice } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import TripCard from "./TripCard";

export function SavedTrips({ trips }: { trips: TripDTO[] }) {
  const { saved } = usePrefs();
  const list = trips.filter((t) => saved.includes(t.id));
  if (!list.length)
    return <div className="empty"><h3 style={{ marginBottom: 8 }}>No saved trips yet</h3>Tap the ♥ on any trip to keep it here. Saved trips stay on this device.<br /><br /><Link className="btn primary" href="/trips">Browse trips</Link></div>;
  return <div className="grid">{list.map((t) => <TripCard key={t.id} t={t} />)}</div>;
}

type Row = [string, (t: TripDTO) => number | string, "min" | "max" | null, (v: number | string) => string];

export function CompareTable({ trips }: { trips: TripDTO[] }) {
  const { compare, toggleCompare, currency, from, adults, childAges } = usePrefs();
  const ts = compare.map((id) => trips.find((t) => t.id === id)).filter((t): t is TripDTO => !!t);
  const people = adults + childAges.length;

  if (ts.length < 2)
    return <div className="empty"><h3 style={{ marginBottom: 8 }}>Pick at least two trips</h3>Tick “Add to compare” on up to three trips, then come back here.<br /><br /><Link className="btn primary" href="/trips">Browse trips</Link></div>;

  const money = (v: number | string) => fmt(Number(v), currency);
  const rows: Row[] = [
    ["Price / person", (t) => ppPrice(t, from), "min", money],
    [`Total for ${people} incl. GST`, (t) => groupTotal(ppPrice(t, from), adults, childAges).total, "min", money],
    ["Nights", (t) => t.nights, null, String],
    ["Price per night", (t) => ppPrice(t, from) / t.nights, "min", money],
    ["Guest rating", (t) => t.rating, "max", (v) => Number(v).toFixed(1)],
    ["Hotel", (t) => t.stars, "max", (v) => "★".repeat(Number(v))],
    ["Meals", (t) => BOARDS[t.board] ?? t.board, null, String],
    ["Flights included", (t) => (t.flight ? "Yes" : "No"), null, String],
    ["Tour manager", (t) => (t.tourManager ? "Yes" : "No"), null, String],
    ["Free cancellation", (t) => (t.freeCancel ? "Yes" : "No"), null, String],
    ["To the beach", (t) => (t.beach === null ? "—" : t.beach === 0 ? "On the beach" : `${t.beach} m`), null, String],
  ];

  return (
    <div className="table-wrap">
      <table className="cmp-table">
        <tbody>
          <tr>
            <th />
            {ts.map((t) => (
              <td key={t.id}>
                <img src={t.image} alt="" />
                <b style={{ fontFamily: "var(--f-display)" }}>{t.dest}</b><br />
                <span className="muted" style={{ fontSize: 12 }}>{t.title}</span><br />
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => toggleCompare(t.id)}>Remove</button>
              </td>
            ))}
          </tr>
          {rows.map(([label, f, best, show]) => {
            const vals = ts.map(f);
            const nums = vals.filter((v): v is number => typeof v === "number");
            const b = best === "min" ? Math.min(...nums) : best === "max" ? Math.max(...nums) : null;
            return (
              <tr key={label}>
                <th>{label}</th>
                {vals.map((v, i) => <td key={ts[i].id} className={`${b !== null && v === b ? "best" : ""} ${typeof v === "number" ? "mono" : ""}`}>{show(v)}</td>)}
              </tr>
            );
          })}
          <tr><th />{ts.map((t) => <td key={t.id}><Link className="btn primary" href={`/trips/${t.slug}`}>View trip</Link></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
