import type { Metadata } from "next";
import { CompareTable } from "@/components/SavedAndCompare";
import { getPublishedTrips } from "@/lib/trips";

export const metadata: Metadata = { title: "Compare trips", robots: { index: false } };

export default async function ComparePage() {
  const trips = await getPublishedTrips();
  return (
    <>
      <div className="wrap page-head">
        <span className="kicker">Side by side</span>
        <h1>Compare trips</h1>
        <p>The best value in each row is green. Totals use your travellers and departure city.</p>
      </div>
      <section className="band" style={{ paddingTop: 24 }}><div className="wrap"><CompareTable trips={trips} /></div></section>
    </>
  );
}
