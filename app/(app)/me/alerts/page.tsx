import type { Metadata } from "next";
import Link from "next/link";
import Notices from "@/components/hub/Notices";
import StopWatch from "@/components/me/StopWatch";
import { myDashboard } from "@/lib/dashboard";
import { noticesFor } from "@/lib/notifications";
import { fmt } from "@/lib/pricing";

export const metadata: Metadata = { title: "Alerts & updates", robots: { index: false } };

export default async function Alerts() {
  const { d, owner } = (await myDashboard())!;
  const notices = await noticesFor(owner, { take: 30 });
  return (
    <div className="wrap">
      <div className="app-page-head"><div><h1>Alerts & updates</h1><p>Riya re-checks your trips every morning and tells you what changed.</p></div></div>
      <section className="app-sec">
        <h2>Price alerts</h2>
        {d.watching.length === 0 ? (
          <div className="app-empty"><b>No price alerts</b><p>On any trip page, tap “Alert me if the price drops”, or ask Riya to watch a price for you.</p><Link className="btn" href="/trips">Browse trips</Link></div>
        ) : (
          <div className="app-list">
            {d.watching.map((w, i) => (
              <div key={w.id} className="app-row" style={{ ["--i" as string]: i }}>
                <span className="ar-ico">🔔</span>
                <span className="ar-main"><b>{w.dest}</b><small>Email me if it drops below {fmt(w.price)} per adult</small></span>
                <Link className="btn sm" href={`/trips/${w.slug}`}>View</Link>
                <StopWatch id={w.id} />
              </div>
            ))}
          </div>
        )}
      </section>
      {notices.length > 0 ? <Notices items={notices} title="Updates from Riya" /> : <p className="muted">No updates yet. They appear here and in your inbox when something changes.</p>}
    </div>
  );
}
