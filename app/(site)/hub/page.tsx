import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StartMission } from "@/components/hub/HubClient";
import { listMissions } from "@/lib/missions";
import { getOwner } from "@/lib/owner";
import Notices from "@/components/hub/Notices";
import { noticesFor } from "@/lib/notifications";
import { watchesFor } from "@/lib/watches";
import { getPublishedTrips } from "@/lib/trips";
import { fmt } from "@/lib/pricing";

export const metadata: Metadata = { title: "Trip hub", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HubPage() {
  const owner = await getOwner();
  const [missions, notices, watches, trips] = await Promise.all([listMissions(owner), noticesFor(owner, { take: 5, sinceDays: 30 }), watchesFor(owner), getPublishedTrips()]);
  const watching = watches.map((w) => ({ w, t: trips.find((t) => t.id === w.tripId) })).filter((x) => x.t);
  return (
    <div className="wrap hub">
      <div className="page-head">
        <span className="kicker">Trip hub</span>
        <h1>Your trips</h1>
        <p>Everything Riya is handling for you, from choosing the trip to visa, insurance and forex. Anything that needs your OK shows up here. <Link href="/you">See what Riya knows about you</Link>.</p>
      </div>
      {(notices.length > 0 || watching.length > 0) && (
        <div className="hub-updates">
          <Notices items={notices} title="Latest from Riya" />
          {watching.length > 0 && (
            <section className="panel">
              <h2 style={{ fontSize: 17 }}>Price alerts</h2>
              <p className="fine">Riya checks these every morning and emails you when the price really drops.</p>
              <ul className="watch-list">
                {watching.map(({ w, t }) => <li key={w.id}><Link href={`/trips/${t!.slug}`}>{t!.dest}</Link> · under {fmt(w.lastPrice)}{w.departureId ? "" : " (any date)"}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
      {missions.length === 0 ? (
        <div className="empty hub-empty">
          <h3>No trips yet</h3>
          <p>Tell Riya where you&apos;d like to go, or what kind of trip you want. She&apos;ll find the best option and take care of the rest.</p>
          <StartMission />
          {!owner.customerId && <p className="fine" style={{ marginTop: 14 }}>Already started on another device? <Link href="/login?next=/hub">Sign in</Link> to see those trips.</p>}
        </div>
      ) : (
        <div className="hub-grid stagger">
          {missions.map((m) => (
            <Link key={m.id} href={`/hub/${m.id}`} className="hub-card">
              <span className="hub-img">{m.image ? <Image src={m.image} alt="" fill sizes="360px" /> : <span className="hub-ph">🧭</span>}</span>
              <span className="hub-body">
                <b>{m.title}</b>
                <span className="hub-bar" aria-label={`${m.progress}% done`}><i style={{ width: `${m.progress}%` }} /></span>
                <small>{m.needsYou ? <span className="warn-txt">{m.needsYou} waiting for your OK</span> : <>Next: {m.next}</>}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
