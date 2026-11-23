import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import TripCard from "@/components/TripCard";
import { BookingProvider } from "@/components/trip/BookingContext";
import BookingPanel, { StickyBookBar } from "@/components/trip/BookingPanel";
import CheckoutSheet from "@/components/trip/CheckoutSheet";
import DepartureCalendar from "@/components/trip/DepartureCalendar";
import QuestionSheet from "@/components/trip/QuestionSheet";
import Reveal from "@/components/ui/Reveal";
import { getPublishedTrips, getTripBySlug } from "@/lib/trips";
import { BOARDS, BOARD_DETAIL, KINDS, ratingWord, seeded } from "@/lib/pricing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateStaticParams() {
  return (await getPublishedTrips()).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getTripBySlug((await params).slug);
  if (!r) return { title: "Trip not found" };
  const t = r.trip;
  return {
    title: t.title,
    description: `${t.nights} nights in ${t.country}. ${t.highlights.join(", ")}. Clear prices with taxes, free 48-hour hold.`,
    openGraph: { images: [t.image] },
  };
}

export default async function TripPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await getTripBySlug(slug);
  if (!r) notFound();
  const { trip: t, departures } = r;
  const initialDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;

  const inclusions: [string, boolean][] = [
    ["Return flights", t.flight],
    ["Airport transfers", t.kind !== "hotel" || t.dest === "Maldives"],
    [`${t.nights} nights in a ${t.stars}★ ${t.kind === "cruise" ? "cabin" : "hotel"}`, true],
    [BOARD_DETAIL[t.board] ?? BOARDS[t.board], true],
    ["Sightseeing with a guide", t.kind !== "hotel"],
    ["Tour manager throughout", t.tourManager],
    ["Travel insurance", t.kind === "escorted"],
    ["Visa fees", false],
  ];
  const meals = (i: number, n: number) =>
    i === 0 ? "Arrival" : i === n - 1 ? "Departure" : t.board === "AI" || t.board === "FB" ? "Breakfast, lunch, dinner" : t.board === "HB" ? "Breakfast, dinner" : "Breakfast";
  const cats: [string, number][] = [["Hotel", t.rating + 0.2], ["Food", t.rating - 0.3], ["Guide & service", t.rating + 0.1], ["Value for money", t.rating - 0.4]];

  const related = (await getPublishedTrips())
    .filter((x) => x.id !== t.id && (x.region === t.region || x.themes.some((th) => t.themes.includes(th))))
    .sort((a, b) => seeded(t.id + a.id) - seeded(t.id + b.id))
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org", "@type": "TouristTrip", name: t.title, description: t.highlights.join(". "),
    touristType: t.themes, image: t.image,
    offers: { "@type": "Offer", priceCurrency: "INR", price: t.price + t.minDelta, availability: departures.length ? "https://schema.org/InStock" : "https://schema.org/SoldOut" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: t.rating, bestRating: 10, reviewCount: t.reviews },
  };

  return (
    <BookingProvider trip={t} departures={departures} initialDate={initialDate}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="trip-hero">
        <Image src={t.image} alt={`${t.dest}: ${t.highlights[0] ?? t.title}`} fill priority sizes="100vw" />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/trips">Trips</Link> / <Link href={`/trips?q=${encodeURIComponent(t.dest)}`}>{t.dest}</Link></nav>
          <span className="kicker" style={{ color: "#ffc531" }}>{KINDS[t.kind]} · {t.country}</span>
          <h1>{t.title}</h1>
          <div className="hero-facts">
            <span><span className="score">{t.rating.toFixed(1)}</span> {ratingWord(t.rating)} · {t.reviews.toLocaleString("en-IN")} reviews</span>
            <span>{t.nights} nights</span><span>{"★".repeat(t.stars)}</span><span>{BOARDS[t.board]}</span>
          </div>
        </div>
      </div>

      <div className="wrap trip-layout">
        <div className="trip-main">
          <nav className="trip-tabs" aria-label="On this page">
            <a href="#overview">Overview</a><a href="#dates">Dates &amp; prices</a><a href="#itinerary">Itinerary</a><a href="#included">Included</a><a href="#reviews">Reviews</a>
          </nav>

          <Reveal><section className="panel" id="overview">
            <div className="meta" style={{ marginBottom: 16 }}>
              {t.beach !== null && <span className="pill">{t.beach === 0 ? "On the beach" : `${t.beach} m to the beach`}</span>}
              {t.flight && <span className="pill">✈ Return flights included</span>}
              {t.tourManager && <span className="pill">Tour manager with you</span>}
              {t.freeCancel ? <span className="pill good">Free cancellation until 30 days before</span> : <span className="pill warn">Cancellation fee applies</span>}
              {t.easyVisa && t.region !== "India" && <span className="pill good">Visa on arrival / e-visa</span>}
            </div>
            <h2>Highlights</h2>
            <ul className="hl">{t.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
          </section></Reveal>

          <Reveal><section className="panel" id="dates">
            <h2>Dates &amp; prices</h2>
            <p className="muted" style={{ marginTop: -6 }}>Price per adult for each departure, flights from your city included. Pick a date to see your total.</p>
            <DepartureCalendar />
          </section></Reveal>

          <Reveal><section className="panel" id="itinerary">
            <h2>Day by day</h2>
            <ol className="itin">
              {t.days.map((d, i) => (
                <li key={i}><span className="dn">Day {i + 1}</span><div><b>{d}</b><small>{meals(i, t.days.length)}</small></div></li>
              ))}
            </ol>
          </section></Reveal>

          <Reveal><section className="panel" id="included">
            <h2>What&apos;s included</h2>
            <ul className="incl">{inclusions.map(([l, y]) => <li key={l} className={y ? "" : "no"}><span className={y ? "y" : "n"} aria-label={y ? "Included" : "Not included"}>{y ? "✓" : "✕"}</span> {l}</li>)}</ul>
            <h2 style={{ marginTop: 24 }}>Good to know</h2>
            <ul className="hl small">
              <li>Prices are per person on twin sharing. Single rooms cost extra.</li>
              <li>Children pay 10% (under 2), 50% (2–5) or 70% (6–11) of the adult price.</li>
              <li>Book with 10% of the total (minimum ₹5,000). Pay the rest 30 days before you leave.</li>
              <li>Passport must be valid for 6 months after you return.</li>
            </ul>
          </section></Reveal>

          <Reveal><section className="panel" id="reviews">
            <h2>Guest ratings</h2>
            <div className="rating-big"><span className="score">{t.rating.toFixed(1)}</span><div><b>{ratingWord(t.rating)}</b><small className="muted">{t.reviews.toLocaleString("en-IN")} verified reviews from travellers who took this trip</small></div></div>
            <div className="bars">
              {cats.map(([l, v]) => <div key={l}><span>{l}</span><i style={{ ["--w" as string]: `${Math.min(100, v * 10)}%` }} /><span className="mono">{Math.min(10, v).toFixed(1)}</span></div>)}
            </div>
          </section></Reveal>
        </div>

        <BookingPanel />
      </div>

      {related.length > 0 && (
        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head"><div><span className="kicker">You may also like</span><h2>Similar trips</h2></div></div>
            <div className="grid">{related.map((x) => <TripCard key={x.id} t={x} />)}</div>
          </div>
        </section>
      )}

      <StickyBookBar />
      <CheckoutSheet />
      <QuestionSheet />
    </BookingProvider>
  );
}
