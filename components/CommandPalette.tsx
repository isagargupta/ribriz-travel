"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TripIndexItem } from "@/lib/types";
import { KINDS, THEMES, adultPrice } from "@/lib/pricing";
import { searchItems, tripFields } from "@/lib/search";
import { usePrefs } from "./Prefs";

interface Item { key: string; label: string; sub: string; href: string; image?: string; price?: number; icon?: string }

const SHORTCUTS: Item[] = [
  { key: "s-deals", label: "Last-minute deals", sub: "Leaving in the next 3 weeks", href: "/trips?deal=lm", icon: "⚡" },
  { key: "s-group", label: "Group tours", sub: "Tour manager, fixed dates", href: "/trips?kind=escorted", icon: "⚑" },
  { key: "s-india", label: "Holidays in India", sub: "Kerala, Kashmir, Rajasthan and more", href: "/trips?region=India", icon: "◉" },
  { key: "s-plan", label: "Plan a custom trip", sub: "Get a costed plan in a day", href: "/plan", icon: "✎" },
  { key: "s-booking", label: "Find my booking", sub: "Check a price hold or booking", href: "/booking", icon: "⌕" },
];

/** ⌘K / Ctrl+K search across trips, destinations and shortcuts. */
export default function CommandPalette({ index, open, setOpen }: { index: TripIndexItem[]; open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const { money, from, recent } = usePrefs();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); }
      else if (e.key === "/" && !open && !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const toItem = (t: TripIndexItem): Item => ({
      key: t.id, label: t.title, sub: `${t.dest}, ${t.country} · ${t.nights} nights · ${KINDS[t.kind]}`,
      href: `/trips/${t.slug}`, image: t.image, price: adultPrice(t.price, t.minDelta, t.flight, from),
    });
    if (!q.trim()) {
      const rec = recent.map((id) => index.find((t) => t.id === id)).filter((t): t is TripIndexItem => !!t).slice(0, 4).map(toItem);
      return [...rec, ...SHORTCUTS];
    }
    const trips = searchItems(q, index, tripFields, 8).map(toItem);
    const themes = searchItems(q, THEMES, (th) => [{ text: th.label + " " + th.key, weight: 2 }], 2)
      .map((th) => ({ key: "th-" + th.key, label: `${th.label} trips`, sub: th.blurb, href: `/trips?theme=${th.key}`, icon: "✦" }));
    const shortcuts = searchItems(q, SHORTCUTS, (s) => [{ text: s.label + " " + s.sub, weight: 1 }], 2);
    const all: Item[] = [...trips, ...themes, ...shortcuts];
    all.push({ key: "all", label: `Search all trips for “${q.trim()}”`, sub: "Open the full results with filters", href: `/trips?q=${encodeURIComponent(q.trim())}`, icon: "→" });
    return all;
  }, [q, index, recent, from]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || typeof document === "undefined") return null;

  const go = (it: Item) => { setOpen(false); router.push(it.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  };
  const recentCount = q.trim() ? 0 : recent.filter((id) => index.some((t) => t.id === id)).slice(0, 4).length;

  return createPortal(
    <div className="palette-root" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search destinations, countries or trip styles…" aria-label="Search"
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[active] ? `pi-${active}` : undefined} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {!q.trim() && recentCount > 0 && <div className="palette-group">Recently viewed</div>}
          {items.map((it, i) => (
            <div key={it.key}>
              {!q.trim() && i === recentCount && <div className="palette-group">Shortcuts</div>}
              <button id={`pi-${i}`} data-i={i} role="option" aria-selected={i === active}
                className={`palette-item ${i === active ? "on" : ""}`} onMouseMove={() => setActive(i)} onClick={() => go(it)}>
                {it.image
                  ? <span className="pi-img"><Image src={it.image} alt="" fill sizes="48px" /></span>
                  : <span className="pi-ico" aria-hidden="true">{it.icon}</span>}
                <span className="pi-text"><b>{it.label}</b><small>{it.sub}</small></span>
                {it.price !== undefined && <span className="pi-price">{money(it.price)}</span>}
              </button>
            </div>
          ))}
          {q.trim() && items.length === 1 && <p className="palette-empty">No trips match “{q}”. Try a country, a city or a style like “beach”.</p>}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⌘</kbd><kbd>K</kbd> toggle</span></div>
      </div>
    </div>,
    document.body,
  );
}
