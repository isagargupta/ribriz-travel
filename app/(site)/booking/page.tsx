import type { Metadata } from "next";
import BookingLookup from "@/components/BookingLookup";

export const metadata: Metadata = { title: "Find my booking", robots: { index: false } };

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  return (
    <>
      <div className="wrap page-head narrow">
        <span className="kicker">Manage booking</span>
        <h1>Find my booking</h1>
        <p>Enter the reference we gave you (it starts with RB-) and the email you used. You&apos;ll see your trip, the price we&apos;re holding and what happens next.</p>
      </div>
      <section className="band" style={{ paddingTop: 24 }}>
        <div className="wrap narrow"><BookingLookup initialRef={ref.toUpperCase().slice(0, 9)} /></div>
      </section>
    </>
  );
}
