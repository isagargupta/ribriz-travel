"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePrefs } from "./Prefs";
import type { Currency } from "@/lib/pricing";

const NAV = [
  { href: "/trips?deal=lm", label: "Deals", hot: true },
  { href: "/trips?kind=escorted", label: "Group tours" },
  { href: "/trips?region=India", label: "India" },
  { href: "/trips?theme=honeymoon", label: "Honeymoon" },
  { href: "/plan", label: "Plan my trip" },
];

export default function Header() {
  const { currency, set, saved } = usePrefs();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="top">
      <div className="wrap" style={{ position: "relative" }}>
        <Link className="logo" href="/" aria-label="Ribriz Travel home">
          <img src="/img/logo.png" alt="Ribriz" width={98} height={40} />
          <span className="word">TRAVEL</span>
        </Link>
        <nav className={`main ${open ? "open" : ""}`} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={n.hot ? "hot" : undefined} onClick={() => setOpen(false)}
              aria-current={path === n.href.split("?")[0] && n.href === "/plan" ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="tools">
          <select aria-label="Currency" value={currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            <option value="INR">₹ INR</option>
            <option value="EUR">€ EUR</option>
            <option value="PLN">zł PLN</option>
          </select>
          <Link className="pill-btn" href="/saved" aria-label={`Saved trips: ${saved.length}`}>♥<span className="badge-count">{saved.length}</span></Link>
          <button className="pill-btn menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        </div>
      </div>
    </header>
  );
}
