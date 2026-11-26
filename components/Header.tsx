"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TripIndexItem } from "@/lib/types";
import type { Currency } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import CommandPalette from "./CommandPalette";
import { askRiya } from "./assistant/Assistant";

/** Four top-level items; everything else lives in their menus. */
type Item = { href?: string; ask?: string; label: string; desc?: string; icon: string; hot?: boolean };
type Group = { title: string; items: Item[] };
const MENUS: { id: string; label: string; groups: Group[]; feature?: { title: string; text: string; href?: string; ask?: string; cta: string } }[] = [
  {
    id: "holidays", label: "Holidays",
    groups: [
      { title: "By style", items: [
        { href: "/trips?deal=lm", label: "Last-minute deals", icon: "🔥", hot: true },
        { href: "/trips?kind=escorted", label: "Group tours", icon: "🧑‍🤝‍🧑" },
        { href: "/trips?theme=honeymoon", label: "Honeymoon", icon: "💞" },
        { href: "/trips?theme=family", label: "Family", icon: "👨‍👩‍👧" },
        { href: "/trips?theme=beach", label: "Beach", icon: "🏖️" },
        { href: "/trips?kind=cruise", label: "Cruises", icon: "🛳️" },
      ] },
      { title: "By region", items: [
        { href: "/trips?region=India", label: "India", icon: "🇮🇳" },
        { href: `/trips?region=${encodeURIComponent("South-East Asia")}`, label: "South-East Asia", icon: "🌴" },
        { href: `/trips?region=${encodeURIComponent("Middle East")}`, label: "Middle East", icon: "🕌" },
        { href: "/trips?region=Europe", label: "Europe", icon: "🏰" },
        { href: "/trips?region=Mediterranean", label: "Mediterranean", icon: "⛵" },
        { href: "/destinations", label: "Destination guides", icon: "🗺️" },
        { href: "/trips", label: "All holidays", icon: "🧭" },
      ] },
    ],
    feature: { title: "Not sure where?", text: "Tell Riya your budget and dates. She finds the best trip and handles the rest.", ask: "Help me plan a trip", cta: "Plan with Riya" },
  },
  {
    id: "services", label: "Services",
    groups: [
      { title: "Before you go", items: [
        { href: "/visa", label: "Visa checker", desc: "What your passport needs, instantly", icon: "🛂" },
        { ask: "I need help applying for a visa", label: "Visa application help", desc: "Document check and filing", icon: "📄" },
        { ask: "I need travel insurance for my trip", label: "Travel insurance", desc: "Plans sized to your trip", icon: "🛡️" },
      ] },
      { title: "Bookings", items: [
        { ask: "I need forex for my trip", label: "Forex and cards", desc: "Live rates, delivered", icon: "💱" },
        { ask: "Find me flights", label: "Flights", desc: "Best fares, sent to you", icon: "✈️" },
        { ask: "Find me a hotel", label: "Hotels", desc: "Options in your budget", icon: "🏨" },
      ] },
    ],
  },
];

function useClickAway(ref: React.RefObject<HTMLElement | null>, on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [on, close, ref]);
}

function MenuItem({ it, onPick }: { it: Item; onPick: () => void }) {
  const inner = (
    <>
      <span className="mi-ico" aria-hidden="true">{it.icon}</span>
      <span className="mi-txt"><b>{it.label}{it.hot && <em>HOT</em>}</b>{it.desc && <small>{it.desc}</small>}</span>
    </>
  );
  return it.href
    ? <Link className="mi" href={it.href} onClick={onPick}>{inner}</Link>
    : <button type="button" className="mi" onClick={() => { onPick(); askRiya(it.ask); }}>{inner}</button>;
}

export default function Header({ index }: { index: TripIndexItem[] }) {
  const { currency, set, saved, priceMode, ready, me } = usePrefs();
  const path = usePathname();
  const [menu, setMenu] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const hoverT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setMenu(null); setDrawer(false); }, [path]);
  useEffect(() => { document.body.style.overflow = drawer ? "hidden" : ""; }, [drawer]);
  useClickAway(navRef, !!menu && !menu.startsWith("t:"), () => setMenu(null));
  useClickAway(toolsRef, !!menu?.startsWith("t:"), () => setMenu(null));

  // hover opens on devices with a mouse; click always toggles
  const hoverOpen = (id: string) => { if (!window.matchMedia("(hover: hover)").matches) return; if (hoverT.current) clearTimeout(hoverT.current); hoverT.current = setTimeout(() => setMenu(id), 80); };
  const hoverClose = () => { if (!window.matchMedia("(hover: hover)").matches) return; if (hoverT.current) clearTimeout(hoverT.current); hoverT.current = setTimeout(() => setMenu((m) => (m?.startsWith("t:") ? m : null)), 160); };
  const close = () => { setMenu(null); setDrawer(false); };
  const initial = me ? (me.name || me.email)[0].toUpperCase() : "";

  return (
    <>
    <header className={`top ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap hdr">
        <Link className="logo" href="/" aria-label="Ribriz Travel home">
          <img src="/img/logo.png" alt="Ribriz" width={98} height={40} />
          <span className="word">TRAVEL</span>
        </Link>

        <nav className="nav2" aria-label="Main" ref={navRef}>
          {MENUS.map((m) => (
            <div key={m.id} className={`nav2-item ${menu === m.id ? "open" : ""}`} onMouseEnter={() => hoverOpen(m.id)} onMouseLeave={hoverClose}>
              <button type="button" className="nav2-btn" aria-expanded={menu === m.id} aria-controls={`menu-${m.id}`} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                {m.label}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
              <div id={`menu-${m.id}`} className={`mega ${m.feature ? "has-feature" : ""}`} hidden={menu !== m.id}>
                {m.groups.map((g) => (
                  <div key={g.title} className="mega-col">
                    <h6>{g.title}</h6>
                    {g.items.map((it) => <MenuItem key={it.label} it={it} onPick={close} />)}
                  </div>
                ))}
                {m.feature && (m.feature.ask ? (
                  <button type="button" className="mega-feature" onClick={() => { close(); askRiya(m.feature!.ask); }}>
                    <span className="mf-orb" aria-hidden="true" />
                    <b>{m.feature.title}</b><p>{m.feature.text}</p><span className="mf-cta">{m.feature.cta} →</span>
                  </button>
                ) : (
                  <Link href={m.feature.href ?? "/"} className="mega-feature" onClick={close}>
                    <span className="mf-orb" aria-hidden="true" />
                    <b>{m.feature.title}</b><p>{m.feature.text}</p><span className="mf-cta">{m.feature.cta} →</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href="/plan" className="nav2-btn" aria-current={path === "/plan" ? "page" : undefined}>Plan my trip</Link>
          <button type="button" className="nav2-btn nav2-riya" onClick={() => askRiya()}><span aria-hidden="true">✦</span> Ask Riya</button>
        </nav>

        <div className="tools" ref={toolsRef}>
          <button className="icon-pill" onClick={() => setSearch(true)} aria-label="Search trips" title="Search (⌘K)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>

          <div className={`drop ${menu === "t:prefs" ? "open" : ""}`}>
            <button className="icon-pill prefs-pill" aria-expanded={menu === "t:prefs"} aria-label="Currency and price display" onClick={() => setMenu(menu === "t:prefs" ? null : "t:prefs")}>
              {currency === "INR" ? "₹" : currency === "EUR" ? "€" : "zł"}<small>{priceMode === "pp" ? "/adult" : "total"}</small>
            </button>
            <div className="drop-menu prefs-menu" hidden={menu !== "t:prefs"}>
              <h6>Show prices in</h6>
              <div className="seg-row">{(["INR", "EUR", "PLN"] as Currency[]).map((c) => <button key={c} aria-pressed={currency === c} onClick={() => set({ currency: c })}>{c === "INR" ? "₹ INR" : c === "EUR" ? "€ EUR" : "zł PLN"}</button>)}</div>
              <h6>Show</h6>
              <div className="seg-row">
                <button aria-pressed={priceMode === "pp"} onClick={() => set({ priceMode: "pp" })}>Per adult</button>
                <button aria-pressed={priceMode === "total"} onClick={() => set({ priceMode: "total" })}>Group total</button>
              </div>
            </div>
          </div>

          <Link className="icon-pill" href="/saved" aria-label={`Saved trips: ${saved.length}`} title="Saved trips">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
            {ready && saved.length > 0 && <span className="badge-count" key={saved.length}>{saved.length}</span>}
          </Link>

          {me === undefined ? <span className="acct-slot" aria-hidden="true" /> : me ? (
            <div className={`drop ${menu === "t:me" ? "open" : ""}`}>
              <button className="acct" aria-expanded={menu === "t:me"} aria-label="Your account" onClick={() => setMenu(menu === "t:me" ? null : "t:me")}>{initial}</button>
              <div className="drop-menu acct-menu" hidden={menu !== "t:me"}>
                <div className="acct-who"><b>{me.name ?? "Your account"}</b><small>{me.email}</small></div>
                <Link href="/me" onClick={close}>✦ Travel HQ</Link>
                <Link href="/me/trips" onClick={close}>🧭 My trips</Link>
                <Link href="/me/bookings" onClick={close}>🎟️ Bookings</Link>
                <Link href="/me/profile" onClick={close}>🧠 What Riya knows</Link>
                <form action="/api/logout" method="post"><button>Sign out</button></form>
              </div>
            </div>
          ) : <Link className="pill-btn signin" href="/login">Sign in</Link>}

          <button className="icon-pill menu-btn" aria-expanded={drawer} aria-label="Menu" onClick={() => setDrawer(!drawer)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">{drawer ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      <CommandPalette index={index} open={search} setOpen={setSearch} />
    </header>

      {/* outside the header: its backdrop blur would otherwise trap this fixed panel inside it */}
      {drawer && (
        <div className="drawer" role="dialog" aria-label="Menu">
          <button type="button" className="drawer-riya" onClick={() => { close(); askRiya(); }}><span className="mf-orb" aria-hidden="true" /><span><b>Ask Riya</b><small>Your AI travel agent plans and books everything</small></span></button>
          {MENUS.map((m) => (
            <details key={m.id} className="drawer-sec" open={m.id === "holidays"}>
              <summary>{m.label}</summary>
              {m.groups.flatMap((g) => g.items).map((it) => <MenuItem key={it.label} it={it} onPick={close} />)}
            </details>
          ))}
          <Link className="drawer-link" href="/plan" onClick={close}>Plan my trip</Link>
          <Link className="drawer-link" href="/booking" onClick={close}>Find my booking</Link>
          {me ? <Link className="drawer-link" href="/me" onClick={close}>Travel HQ</Link> : <Link className="btn hot block" href="/login" onClick={close}>Sign in</Link>}
        </div>
      )}
    </>
  );
}
