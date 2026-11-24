import type { Metadata } from "next";
import Link from "next/link";
import AskButton from "@/components/me/AskButton";
import TripCardX from "@/components/me/TripCardX";
import { myDashboard } from "@/lib/dashboard";
import { fmtDate } from "@/lib/pricing";

export const metadata: Metadata = { title: "My trips", robots: { index: false } };

export default async function Trips() {
  const { d } = (await myDashboard())!;
  return (
    <div className="wrap">
      <div className="app-page-head">
        <div><h1>My trips</h1><p>Every trip Riya is running for you. Tap any step to see what&apos;s happening.</p></div>
        <AskButton className="btn hot" q="Plan a new trip for me">✦ Plan a new trip</AskButton>
      </div>
      {d.trips.length === 0 ? (
        <div className="app-empty"><span className="mini-orb" style={{ width: 64, height: 64 }} /><b>No trips yet</b><p>Tell Riya where you&apos;d like to go. She sets up the plan and you&apos;ll see each step here.</p><AskButton className="btn hot" q="Help me plan a trip">Start with Riya</AskButton></div>
      ) : <div className="me-trips">{d.trips.map((t, i) => <TripCardX key={t.id} t={t} i={i} />)}</div>}
      {d.past.length > 0 && (
        <section className="app-sec" style={{ marginTop: 32 }}>
          <h2>Past trips</h2>
          <div className="app-list">
            {d.past.map((t, i) => (
              <Link key={t.id} href={`/me/trips/${t.id}`} className="app-row" style={{ ["--i" as string]: i, textDecoration: "none", color: "inherit" }}>
                <span className="ar-ico">🧳</span><span className="ar-main"><b>{t.dest ?? t.title}</b><small>{t.date ? fmtDate(t.date, { day: "numeric", month: "short", year: "numeric" }) : t.title}</small></span><span>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
