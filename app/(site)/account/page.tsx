import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/auth/ProfileForm";
import { prisma } from "@/lib/db";
import { currentCustomer } from "@/lib/customer";
import { HOLD_HOURS, addDays, fmt, fmtDate, isoDate } from "@/lib/pricing";

export const metadata: Metadata = { title: "My trips", robots: { index: false } };

const TYPE_LABEL: Record<string, string> = { hold: "Price hold", enquiry: "Question", custom: "Custom trip request" };
const STATUS_LABEL: Record<string, string> = { new: "Received", contacted: "In progress", booked: "Booked", closed: "Closed" };

export default async function AccountPage() {
  const me = await currentCustomer();
  if (!me) redirect("/login?next=/account");

  const items = await prisma.enquiry.findMany({
    where: { email: me.email },
    orderBy: { createdAt: "desc" },
    include: { trip: { select: { slug: true, image: true, nights: true } } },
  });
  const today = isoDate(new Date());
  const upcoming = items.filter((e) => e.status === "booked" && e.departure && e.departure >= today);
  const rest = items.filter((e) => !upcoming.includes(e));

  const row = (e: (typeof items)[number]) => {
    const holdEnds = e.type === "hold" ? new Date(e.createdAt.getTime() + HOLD_HOURS * 3600e3) : null;
    const expired = holdEnds && e.status === "new" && holdEnds.getTime() < Date.now();
    return (
      <article key={e.id} className="acc-item">
        <span className="acc-img">{e.trip?.image ? <Image src={e.trip.image} alt="" fill sizes="120px" /> : <span className="acc-ph">✎</span>}</span>
        <div className="acc-body">
          <div className="acc-top">
            <span className="mono muted">{e.ref}</span>
            <span className={`status ${expired ? "closed" : e.status}`}>{expired ? "Hold ended" : STATUS_LABEL[e.status] ?? e.status}</span>
          </div>
          <b>{e.tripTitle ?? TYPE_LABEL[e.type]}</b>
          <small className="muted">
            {TYPE_LABEL[e.type]}
            {e.departure && <> · {fmtDate(e.departure)}{e.trip?.nights ? ` – ${fmtDate(addDays(e.departure, e.trip.nights), { day: "numeric", month: "short", year: "numeric" })}` : ""}</>}
            {` · ${e.adults} adult${e.adults > 1 ? "s" : ""}${e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}`}
          </small>
          {holdEnds && e.status === "new" && !expired && <small className="warn-txt">Price held until {holdEnds.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small>}
        </div>
        <div className="acc-side">
          {e.quotedTotal ? <b className="mono">{fmt(e.quotedTotal)}</b> : null}
          <div className="acc-links">
            <Link className="btn sm" href={`/booking?ref=${e.ref}`}>Details</Link>
            {e.trip?.slug && <Link className="btn sm" href={`/trips/${e.trip.slug}`}>Trip page</Link>}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="wrap account">
      <div className="page-head acc-head">
        <div>
          <span className="kicker">My account</span>
          <h1>Hi {me.name?.split(" ")[0] ?? "there"}</h1>
          <p>Signed in as <b>{me.email}</b></p>
        </div>
        <form action="/api/logout" method="post"><button className="btn">Sign out</button></form>
      </div>

      <div className="acc-grid">
        <div>
          {upcoming.length > 0 && (
            <section className="panel">
              <h2>Upcoming trips</h2>
              <div className="acc-list">{upcoming.map(row)}</div>
            </section>
          )}
          <section className="panel">
            <h2>{upcoming.length ? "Holds and requests" : "My trips"}</h2>
            {rest.length ? <div className="acc-list">{rest.map(row)}</div> : (
              <div className="empty" style={{ padding: 28 }}>
                <h3>Nothing here yet</h3>
                <p>When you reserve a price or ask us something with {me.email}, it shows up here.</p>
                <Link className="btn hot" href="/trips">Find a trip</Link>
              </div>
            )}
          </section>
        </div>
        <aside className="panel">
          <h2>Your details</h2>
          <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>We use these to fill in your next booking.</p>
          <ProfileForm name={me.name ?? ""} phone={me.phone ?? ""} />
        </aside>
      </div>
    </div>
  );
}
