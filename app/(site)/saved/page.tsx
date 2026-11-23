import type { Metadata } from "next";
import { SavedTrips } from "@/components/SavedAndCompare";
import { getPublishedTrips } from "@/lib/trips";

export const metadata: Metadata = { title: "Saved trips", robots: { index: false } };

export default async function SavedPage() {
  const trips = await getPublishedTrips();
  return (
    <>
      <div className="wrap page-head"><span className="kicker">Your shortlist</span><h1>Saved trips</h1></div>
      <section className="band" style={{ paddingTop: 24 }}><div className="wrap"><SavedTrips trips={trips} /></div></section>
    </>
  );
}
