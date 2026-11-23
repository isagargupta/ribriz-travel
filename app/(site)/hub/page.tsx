import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StartMission } from "@/components/hub/HubClient";
import { listMissions } from "@/lib/missions";
import { getOwner } from "@/lib/owner";

export const metadata: Metadata = { title: "Trip hub", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HubPage() {
  const owner = await getOwner();
  const missions = await listMissions(owner);
  return (
    <div className="wrap hub">
      <div className="page-head">
        <span className="kicker">Trip hub</span>
        <h1>Your trips</h1>
        <p>Everything Riya is handling for you, from choosing the trip to visa, insurance and forex. Anything that needs your OK shows up here.</p>
      </div>
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
