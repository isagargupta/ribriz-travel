"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Assistant from "../assistant/Assistant";
import { usePrefs } from "../Prefs";
import type { Currency } from "@/lib/pricing";

const NAV = [
  { href: "/me", label: "Overview", icon: "✦" },
  { href: "/me/trips", label: "My trips", icon: "🧭", count: "trips" },
  { href: "/me/bookings", label: "Bookings", icon: "🎟️", count: "bookings" },
  { href: "/me/alerts", label: "Alerts & updates", icon: "🔔", count: "alerts" },
  { href: "/me/profile", label: "Profile & memory", icon: "🧠" },
] as const;
const EXPLORE = [
  { href: "/trips", label: "Explore holidays", icon: "🌍" },
  { href: "/trips?deal=lm", label: "Last-minute deals", icon: "🔥" },
  { href: "/visa", label: "Visa checker", icon: "🛂" },
];

type Counts = { trips: number; needs: number; bookings: number; alerts: number };

/**
 * The traveller app: sidebar on the left, the page in the middle, Riya docked on
 * the right. Anything Riya does in chat refreshes the page at once; the page
 * also refreshes itself every 30 s while open. On phones the sidebar becomes a
 * bottom tab bar and Riya opens full screen.
 */
export default function AppShell({ me, counts, children }: { me: { name: string | null; email: string }; counts: Counts; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { currency, set, priceMode } = usePrefs();
  const [riya, setRiya] = useState(false); // panel visibility below the wide breakpoint
  const [collapsed, setCollapsed] = useState(false); // wide screens: hide Riya to give the page room

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (t) clearTimeout(t); t = setTimeout(() => router.refresh(), 250); };
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const onAsk = () => { setRiya(true); setCollapsed(false); };
    window.addEventListener("ribriz:changed", refresh);
    window.addEventListener("ribriz:ask", onAsk);
    document.addEventListener("visibilitychange", tick);
    const poll = setInterval(tick, 30_000);
    return () => { window.removeEventListener("ribriz:changed", refresh); window.removeEventListener("ribriz:ask", onAsk); document.removeEventListener("visibilitychange", tick); clearInterval(poll); };
  }, [router]);
  useEffect(() => { document.body.classList.add("in-app"); return () => document.body.classList.remove("in-app"); }, []);

  const active = (href: string) => (href === "/me" ? path === "/me" : path.startsWith(href));
  const initial = (me.name || me.email)[0].toUpperCase();

  return (
    <div className={`app ${collapsed ? "riya-collapsed" : ""} ${riya ? "riya-open" : ""}`}>
      <aside className="app-side" aria-label="Your travel app">
        <Link href="/me" className="app-brand"><img src="/img/logo.png" alt="Ribriz" height={30} /><span>Travel HQ</span></Link>
        <nav className="app-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "on" : ""} aria-current={active(n.href) ? "page" : undefined}>
              <span className="an-ico" aria-hidden="true">{n.icon}</span>{n.label}
              {"count" in n && counts[n.count] > 0 && <span className="an-count">{counts[n.count]}</span>}
              {n.href === "/me" && counts.needs > 0 && <span className="an-count hot" title="Waiting for your OK">{counts.needs}</span>}
            </Link>
          ))}
        </nav>
        <div className="app-nav-title">Explore</div>
        <nav className="app-nav sub">
          {EXPLORE.map((n) => <Link key={n.href} href={n.href}><span className="an-ico" aria-hidden="true">{n.icon}</span>{n.label}</Link>)}
        </nav>
        <div className="app-side-foot">
          <div className="app-prefs">
            <select aria-label="Currency" value={currency} onChange={(e) => set({ currency: e.target.value as Currency })}><option value="INR">₹ INR</option><option value="EUR">€ EUR</option><option value="PLN">zł PLN</option></select>
            <select aria-label="Prices" value={priceMode} onChange={(e) => set({ priceMode: e.target.value as "pp" | "total" })}><option value="pp">Per adult</option><option value="total">Group total</option></select>
          </div>
          <div className="app-me">
            <span className="app-av">{initial}</span>
            <span className="app-me-txt"><b>{me.name ?? "You"}</b><small>{me.email}</small></span>
            <form action="/api/logout" method="post"><button className="link-btn" title="Sign out">Sign out</button></form>
          </div>
        </div>
      </aside>

      <main className="app-main" id="main">
        <div className="app-top">
          <Link href="/me" className="app-top-brand"><img src="/img/logo.png" alt="Ribriz" height={28} /></Link>
          <span className="app-top-space" />
          <button className="app-riya-btn" onClick={() => setRiya(!riya)} aria-expanded={riya}>
            <span className="mini-orb" aria-hidden="true" /> Riya
          </button>
          <button className="app-collapse" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Show Riya" : "Hide Riya"} aria-label={collapsed ? "Show Riya" : "Hide Riya"}>{collapsed ? "⟨ Riya" : "Riya ⟩"}</button>
        </div>
        {children}
      </main>

      <section className="app-riya" aria-label="Riya">
        <Assistant docked onClose={() => { setRiya(false); if (window.innerWidth >= 1280) setCollapsed(true); }} />
      </section>

      <nav className="app-tabs" aria-label="App">
        <Link href="/me" className={active("/me") && path === "/me" ? "on" : ""}><span>✦</span>Home</Link>
        <Link href="/me/trips" className={active("/me/trips") ? "on" : ""}><span>🧭</span>Trips</Link>
        <button onClick={() => setRiya(true)} className="tab-riya" aria-label="Talk to Riya"><span className="mini-orb" /></button>
        <Link href="/me/bookings" className={active("/me/bookings") ? "on" : ""}><span>🎟️</span>Bookings</Link>
        <Link href="/me/profile" className={active("/me/profile") ? "on" : ""}><span>🧠</span>Profile</Link>
      </nav>
    </div>
  );
}
