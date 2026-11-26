import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDestinations } from "@/lib/destinations";
import { fmt } from "@/lib/pricing";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Destinations: when to go and what it costs from India",
  description: "Holiday guides for Indian travellers: the best time to visit from 10 years of weather data, visa rules for Indian passports, and package prices from Mumbai.",
};

export default async function DestinationsPage() {
  const ds = await getDestinations();
  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="page-head"><span className="kicker">Destination guides</span><h1>Where to go, and when</h1><p>Best months from ten years of real weather, visa rules for Indian passports, and what a trip costs from India.</p></div>
      <div className="dest-grid">
        {ds.map((d) => (
          <Link key={d.slug} href={`/destinations/${d.slug}`} className="dest-card">
            <span className="dest-img"><Image src={d.image} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" /></span>
            <span className="dest-txt"><b>{d.name}</b><small>{d.country} · {d.trips.length} trip{d.trips.length > 1 ? "s" : ""} · from {fmt(d.fromPrice)}</small></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
