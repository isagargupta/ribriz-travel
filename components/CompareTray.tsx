"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TripIndexItem } from "@/lib/types";
import { adultPrice } from "@/lib/pricing";
import { usePrefs } from "./Prefs";

export default function CompareTray({ index }: { index: TripIndexItem[] }) {
  const { compare, toggleCompare, money, from, set } = usePrefs();
  const path = usePathname();
  const items = compare.map((id) => index.find((t) => t.id === id)).filter((t): t is TripIndexItem => !!t);
  if (!items.length || path === "/compare") return null;

  return (
    <div className="tray" role="region" aria-label="Compare trips">
      <div className="tray-in">
        <strong>Compare <span className="muted">{items.length}/3</span></strong>
        <div className="slots">
          {items.map((t) => (
            <span className="slot" key={t.id}>{t.dest} · {money(adultPrice(t.price, t.minDelta, t.flight, from))}
              <button onClick={() => toggleCompare(t.id)} aria-label={`Remove ${t.dest} from compare`}>✕</button>
            </span>
          ))}
        </div>
        <button className="btn ghost-light sm" onClick={() => set({ compare: [] })}>Clear</button>
        {items.length >= 2
          ? <Link className="btn hot" href="/compare">Compare now</Link>
          : <span className="tray-hint">Add one more trip</span>}
      </div>
    </div>
  );
}
