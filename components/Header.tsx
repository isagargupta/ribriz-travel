"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { TripIndexItem } from "@/lib/types";
import type { Currency } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import CommandPalette from "./CommandPalette";

const NAV = [
  { href: "/trips?deal=lm", label: "Deals", hot: true },
  { href: "/trips?kind=escorted", label: "Group tours" },
  { href: "/trips?region=India", label: "India" },
  { href: "/trips?theme=honeymoon", label: "Honeymoon" },
  { href: "/hub", label: "Trip hub" },
  { href: "/visa", label: "Visa checker" },
  { href: "/plan", label: "Plan my trip" },
];

function NavLinks({ onNav }: { onNav: () => void }) {
  const path = usePathname();
  const sp = useSearchParams();
  const current = path + (sp.toString() ? `?${sp}` : "");
  return (
    <>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={n.hot ? "hot" : undefined} onClick={onNav} aria-current={current === n.href ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </>
  );
}

export default function Header({ index }: { index: TripIndexItem[] }) {
  const { currency, set, saved, priceMode, ready, me } = usePrefs();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`top ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap hdr">
        <Link className="logo" href="/" aria-label="Ribriz Travel home">
          <img src="/img/logo.png" alt="Ribriz" width={98} height={40} />
          <span className="word">TRAVEL</span>
        </Link>
        <nav className={`main ${open ? "open" : ""}`} aria-label="Main">
          <Suspense fallback={null}><NavLinks onNav={() => setOpen(false)} /></Suspense>
        </nav>
        <div className="tools">
          <button className="search-btn" onClick={() => setSearch(true)} aria-label="Search trips">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <span className="search-label">Search</span>
            <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <div className="seg mini" role="group" aria-label="Show prices">
            <button aria-pressed={priceMode === "pp"} onClick={() => set({ priceMode: "pp" })} title="Price per adult">Per adult</button>
            <button aria-pressed={priceMode === "total"} onClick={() => set({ priceMode: "total" })} title="Total for your group, including taxes">Total</button>
          </div>
          <select aria-label="Currency" value={currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            <option value="INR">₹ INR</option>
            <option value="EUR">€ EUR</option>
            <option value="PLN">zł PLN</option>
          </select>
          <Link className="pill-btn" href="/saved" aria-label={`Saved trips: ${saved.length}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
            {ready && saved.length > 0 && <span className="badge-count" key={saved.length}>{saved.length}</span>}
          </Link>
          {me === undefined ? <span className="acct-slot" aria-hidden="true" />
            : me ? <Link className="acct" href="/me" aria-label="Your travel HQ" title={me.email}>{(me.name || me.email)[0].toUpperCase()}</Link>
            : <Link className="pill-btn signin" href="/login">Sign in</Link>}
          <button className="pill-btn menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      <CommandPalette index={index} open={search} setOpen={setSearch} />
    </header>
  );
}
