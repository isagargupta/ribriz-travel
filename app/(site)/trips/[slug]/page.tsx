import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingBox from "@/components/BookingBox";
import TripCard from "@/components/TripCard";
import { getPublishedTrips, getTripBySlug } from "@/lib/trips";
import { BOARDS, KINDS, isoDate, ratingWord, seeded } from "@/lib/pricing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTripBySlug((await params).slug);
  if (!t) return { title: "Trip not found" };
  return {
    title: t.title,
    description: `${t.nights} nights in ${t.country}. ${t.highlights.join(", ")}.`,
    openGraph: { images: [t.image] },
  };
}

export default async function TripPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const t = await getTripBySlug(slug);
  if (!t) notFound();

  // Departures start near the date the visitor searched for, never in the past.
  const today = isoDate(new Date());
  let start = today;
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) {
    const d = new Date(sp.date + "T00:00:00");
    d.setDate(d.getDate() - Number(sp.flex || 0) - 3);
    start = isoDate(d) > today ? isoDate(d) : today;
  }

  const inclusions: [string, boolean][] = [
    ["Return flights", t.flight],
    ["Airport transfers", t.kind !== "hotel" || t.dest === "Maldives"],
    [`Hotel, ${t.stars}★`, t.kind !== "cruise"],
    [`Meals: ${BOARDS[t.board] ?? t.board}`, true],
    ["Sightseeing with guide", t.kind !== "hotel"],
    ["Tour manager throughout", t.tourManager],
    ["Visa fees", false],
    ["Travel insurance", t.kind === "escorted"],
  ];
  const meals = (i: number, n: number) =>
    i === 0 ? "Arrival" : i === n - 1 ? "Departure" : t.board === "AI" || t.board === "FB" ? "Breakfast, lunch, dinner" : t.board === "HB" ? "Breakfast, dinner" : "Breakfast";
  const cats: [string, number][] = [["Hotel", t.rating + 0.2], ["Food", t.rating - 0.3], ["Guide & service", t.rating + 0.1], ["Value for money", t.rating - 0.4]];

  const related = (await getPublishedTrips())
    .filter((x) => x.id !== t.id && (x.region === t.region || x.themes.some((th) => t.themes.includes(th))))
    .sort((a, b) => seeded(t.id + a.id) - seeded(t.id + b.id))
    .slice(0, 3);

  return (
    <>
      <div className="trip-hero">
        <img src={t.image} alt={`${t.dest}: ${t.highlights[0] ?? t.title}`} />
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link> / <Link href="/trips">Trips</Link> / <Link href={`/trips?q=${encodeURIComponent(t.dest)}`}>{t.dest}</Link></div>
          <span className="kicker" style={{ color: "#ffc531" }}>{KINDS[t.kind]} · {t.country}</span>
          <h1 style={{ marginTop: 8 }}>{t.title}</h1>
        </div>
      </div>

      <div className="wrap trip-layout">
        <div>
          <div className="panel">
            <div className="meta" style={{ marginBottom: 14 }}>
              <span className="pill">{t.nights} nights / {t.nights + 1} days</span>
              <span className="pill">{"★".repeat(t.stars)} hotel</span>
              <span className="pill">{BOARDS[t.board] ?? t.board}</span>
              {t.beach !== null && <span className="pill">{t.beach === 0 ? "On the beach" : `${t.beach} m to the beach`}</span>}
              {t.freeCancel ? <span className="pill good">Free cancellation until 30 days before</span> : <span className="pill warn">Cancellation fee applies</span>}
              {t.easyVisa && t.region !== "India" && <span className="pill good">Visa on arrival / e-visa</span>}
            </div>
            <div className="rating" style={{ fontSize: 15 }}><span className="score" style={{ fontSize: 15 }}>{t.rating.toFixed(1)}</span> {ratingWord(t.rating)} · {t.reviews.toLocaleString("en-IN")} verified reviews</div>
          </div>

          <div className="panel">
            <h2>Highlights</h2>
            <ul style={{ margin: 0, paddingLeft: 20, fontWeight: 500, display: "grid", gap: 6 }}>{t.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
          </div>

          <div className="panel">
            <h2>What&apos;s included</h2>
            <ul className="incl">{inclusions.map(([l, y]) => <li key={l} className={y ? "" : "no"}><span className={y ? "y" : ""}>{y ? "✓" : "–"}</span> {l}</li>)}</ul>
          </div>

          <div className="panel">
            <h2>Day by day</h2>
            {t.days.map((d, i) => (
              <div className="day" key={i}><div className="dn">D{i + 1}</div><div><b>{d}</b><span className="muted" style={{ fontSize: 13 }}>{meals(i, t.days.length)}</span></div></div>
            ))}
          </div>

          <div className="panel">
            <h2>Guest ratings</h2>
            <div className="bars">
              {cats.map(([l, v]) => <div key={l}><span>{l}</span><i style={{ ["--w" as string]: `${Math.min(100, v * 10)}%` }} /><span className="mono">{Math.min(10, v).toFixed(1)}</span></div>)}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Only travellers who completed this trip can leave a rating.</p>
          </div>

          <div className="panel">
            <h2>Good to know</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 14 }}>
              <li>Prices are per person on twin sharing. Single rooms cost extra.</li>
              <li>Book with 10% of the total (minimum ₹5,000). Pay the rest 30 days before departure.</li>
              <li>Passport must be valid for 6 months after you return.</li>
              <li>Flight prices are from Mumbai; other cities adjust automatically when you change &quot;Flying from&quot;.</li>
            </ul>
          </div>
        </div>

        <BookingBox trip={t} startDate={start} />
      </div>

      {related.length > 0 && (
        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head"><div><span className="kicker">You may also like</span><h2>Similar trips</h2></div></div>
            <div className="grid">{related.map((r) => <TripCard key={r.id} t={r} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
