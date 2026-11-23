import type { Metadata } from "next";
import TripExplorer from "@/components/TripExplorer";
import { parseFilters } from "@/lib/filters";
import { getPublishedTrips } from "@/lib/trips";

export const metadata: Metadata = {
  title: "All trips",
  description: "Browse holiday packages, group tours, beach hotels and cruises. Filter by budget, meal plan, stars and more.",
};

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [trips, sp] = await Promise.all([getPublishedTrips(), searchParams]);
  return (
    <>
      <div className="wrap page-head">
        <span className="kicker">All trips</span>
        <h1>Find your trip</h1>
        <p>Every price is per person with flights from your city where included. Taxes are added on the trip page before you book.</p>
      </div>
      <section className="band" style={{ paddingTop: 24 }}>
        <div className="wrap">
          {/* key resets the explorer when a header link changes the query */}
          <TripExplorer key={JSON.stringify(sp)} trips={trips} initial={parseFilters(sp)} />
        </div>
      </section>
    </>
  );
}
