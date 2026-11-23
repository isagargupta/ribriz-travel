"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs } from "./Prefs";
import { fmt, ppPrice } from "@/lib/pricing";

export interface MiniTrip { id: string; dest: string; price: number; flight: boolean }

export default function CompareTray({ trips }: { trips: MiniTrip[] }) {
  const { compare, toggleCompare, currency, from } = usePrefs();
  const path = usePathname();
  const items = compare.map((id) => trips.find((t) => t.id === id)).filter((t): t is MiniTrip => !!t);
  if (!items.length || path === "/compare") return null;

  return (
    <div className="tray" role="region" aria-label="Compare trips">
      <div className="in">
        <strong>Compare</strong>
        <div className="slots">
          {items.map((t) => (
            <span className="slot" key={t.id}>{t.dest} · {fmt(ppPrice(t, from), currency)}
              <button onClick={() => toggleCompare(t.id)} aria-label={`Remove ${t.dest} from compare`}>✕</button>
            </span>
          ))}
          {items.length < 3 && <span className="slot" style={{ opacity: .6 }}>+ add {3 - items.length} more</span>}
        </div>
        {items.length >= 2
          ? <Link className="btn hot" href="/compare">Compare now</Link>
          : <button className="btn hot" disabled>Compare now</button>}
      </div>
    </div>
  );
}
