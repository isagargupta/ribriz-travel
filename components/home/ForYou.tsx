"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TripDTO } from "@/lib/types";
import { usePrefs } from "../Prefs";
import TripCard from "../TripCard";
import { Rail } from "./HomeSections";

interface Pick { id: string; reason: string }

/** Trips picked for this traveller, each with the reason in a few words. */
export default function ForYou({ trips }: { trips: TripDTO[] }) {
  const { ready, recent, saved, passport, me } = usePrefs();
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [remembered, setRemembered] = useState(0);
  const key = `${recent.slice(0, 10).join()}|${saved.join()}|${passport}`;

  useEffect(() => {
    if (!ready) return;
    const ctl = new AbortController();
    fetch("/api/for-you", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viewed: recent.slice(0, 10), saved, passport }), signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setPicks(j.picks); setRemembered(j.remembered); } })
      .catch(() => {});
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  const list = (picks ?? []).map((p) => ({ p, t: trips.find((t) => t.id === p.id) })).filter((x): x is { p: Pick; t: TripDTO } => !!x.t);
  if (list.length < 3) return null; // too little to go on: the trending section does the job
  const name = me?.name?.split(" ")[0];
  return (
    <section className="band for-you" style={{ paddingBottom: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <div><span className="kicker">Picked by Riya</span><h2>{name ? `For you, ${name}` : "Picked for you"}</h2></div>
          <p>{remembered ? <>Based on what you&apos;ve told Riya and the trips you&apos;ve looked at. <Link href="/you">See what Riya knows</Link></> : <>Based on the trips you&apos;ve looked at. <Link href="/you">Tell Riya what you like</Link> to sharpen these.</>}</p>
        </div>
        <Rail label="Trips picked for you">
          {list.map(({ p, t }) => (
            <div key={t.id} className="fy-item">
              <span className="fy-why">{p.reason}</span>
              <TripCard t={t} />
            </div>
          ))}
        </Rail>
      </div>
    </section>
  );
}
