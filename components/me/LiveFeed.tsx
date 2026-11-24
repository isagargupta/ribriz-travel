"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/dashboard";

const WHO: Record<string, { name: string; cls: string }> = {
  agent: { name: "Riya", cls: "riya" }, traveller: { name: "You", cls: "you" }, team: { name: "Ribriz team", cls: "team" }, system: { name: "Ribriz", cls: "team" },
};

function ago(iso: string, now: number) {
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** What's been happening, newest first. The top row shows Riya currently at work. */
export default function LiveFeed({ items, working }: { items: FeedItem[]; working: string[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [w, setW] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (working.length < 2) return; const t = setInterval(() => setW((x) => x + 1), 3200); return () => clearInterval(t); }, [working.length]);

  return (
    <div className="feed">
      {working.length > 0 && (
        <div className="feed-now" key={w}>
          <span className="feed-av riya"><i className="mini-orb" /></span>
          <div><b>Riya</b> <span className="shimmer-text">{working[w % working.length]}</span><span className="dots"><i /><i /><i /></span></div>
        </div>
      )}
      {items.length === 0 ? <p className="muted">Nothing yet. Updates appear here as Riya works on your trips.</p> : (
        <ol>
          {items.map((e, i) => {
            const who = WHO[e.actor] ?? WHO.system;
            return (
              <li key={e.id} style={{ ["--i" as string]: i }}>
                <span className={`feed-av ${who.cls}`}>{who.cls === "riya" ? <i className="mini-orb" /> : who.name[0]}</span>
                <div>
                  <p><b>{who.name}</b> {e.text}</p>
                  <small>{ago(e.at, now)} · {e.tripId ? <Link href={`/me/trips/${e.tripId}`}>{e.trip}</Link> : e.trip}</small>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
