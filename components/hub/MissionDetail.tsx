import "server-only";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskAboutMission, HubApprovals } from "@/components/hub/HubClient";
import { pendingCard } from "@/lib/approvals";
import { visaChecklist } from "@/lib/documents";
import VisaPanel from "@/components/visa/VisaPanel";
import { missionView } from "@/lib/missions";
import { getOwner } from "@/lib/owner";
import { addDays, daysBetween, fmtDate, isoDate } from "@/lib/pricing";
import { countryName } from "@/lib/visa";
import Notices from "@/components/hub/Notices";
import Bookings from "@/components/hub/Bookings";
import { bookingsFor } from "@/lib/offers";
import { markSeen, noticesFor } from "@/lib/notifications";
import LiveTrip from "@/components/me/LiveTrip";
import { liveTrips } from "@/lib/live";
import { groupOf, inviteUrl } from "@/lib/group";
import CopyLink from "@/components/CopyLink";
import { prisma } from "@/lib/db";
import { payUrl } from "@/lib/payments";


const STATUS: Record<string, { label: string; icon: string }> = {
  todo: { label: "To do", icon: "○" }, in_progress: { label: "Riya is on it", icon: "◐" }, needs_approval: { label: "Needs your OK", icon: "!" },
  waiting: { label: "With our team", icon: "◔" }, done: { label: "Done", icon: "✓" }, skipped: { label: "Not needed", icon: "–" },
};
const ACTOR: Record<string, string> = { agent: "Riya", traveller: "You", team: "Ribriz team", system: "Ribriz" };

/** One trip in full: approvals, updates, bookings, visa, plan and timeline. Used by the trip hub and the traveller app. */
export default async function MissionDetail({ id, backHref, backLabel = "← All trips" }: { id: string; backHref: string; backLabel?: string }) {
  const owner = await getOwner();
  const m = await missionView(owner, id);
  if (!m) notFound();
  const pending = (await Promise.all(m.approvals.filter((a) => a.status === "pending").map((a) => pendingCard(owner, a.id)))).filter((c) => c !== null);
  const days = m.date ? daysBetween(isoDate(new Date()), m.date) : null;
  const visa = m.trip ? await visaChecklist(owner, m.id) : null;
  const [notices, bookings] = await Promise.all([noticesFor(owner, { missionId: m.id, take: 6 }), bookingsFor(m.id)]);
  await markSeen(owner, notices.filter((n) => n.unread).map((n) => n.id)); // shown as new this once
  const live = backHref.startsWith("/me") ? (await liveTrips(owner)).find((t) => t.missionId === m.id) : undefined;
  const group = backHref.startsWith("/me") && m.adults + m.childAges.length > 1 ? await groupOf(m.id) : null;
  const isOwner = !!group && group.ownerId === owner.customerId;
  const holdRef = group ? (await prisma.enquiry.findFirst({ where: { missionId: m.id, type: { in: ["hold", "custom"] }, status: { not: "closed" } }, orderBy: { createdAt: "desc" }, select: { ref: true } }))?.ref : null;

  return (
    <div className="wrap hub">
      <div className="hub-hero">
        {m.trip && <Image src={m.trip.image} alt="" fill priority sizes="100vw" />}
        <div className="hub-hero-in">
          <Link href={backHref} className="crumbs">{backLabel}</Link>
          <h1>{m.title}</h1>
          <p>{m.trip ? <>{m.trip.title}{m.date ? <> · {fmtDate(m.date)} – {fmtDate(addDays(m.date, m.trip.nights), { day: "numeric", month: "short", year: "numeric" })}</> : null}</> : "Riya is still finding the best trip for you."}</p>
          <div className="hub-facts">
            <span>{m.adults} adult{m.adults > 1 ? "s" : ""}{m.childAges.length ? `, ${m.childAges.length} child${m.childAges.length > 1 ? "ren" : ""}` : ""}</span>
            <span>from {m.fromCity}</span><span>{countryName(m.passport)} passport</span>
            {days !== null && days >= 0 && <span className="hub-count">{days === 0 ? "Leaving today!" : `${days} days to go`}</span>}
          </div>
        </div>
        <div className="hub-ring" style={{ ["--p" as string]: m.progress }} aria-label={`${m.progress}% done`}><b>{m.progress}%</b><small>done</small></div>
      </div>

      <div className="hub-layout">
        <div className="hub-main">
          {live && <LiveTrip t={live} />}
          {pending.length > 0 && (
            <section className="panel">
              <h2>{pending.some((c) => c.action === "accept_offer") ? "Choose and approve" : "Waiting for your OK"}</h2>
              <HubApprovals cards={pending} />
            </section>
          )}
          {group && (
            <section className="panel">
              <div className="hub-sec-head"><h2>Travelling together</h2><span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{holdRef && <Link className="btn sm" href={payUrl(holdRef)}>Pay a share</Link>}{isOwner && <CopyLink path={inviteUrl(m.id)} label="Invite travel companions" title={`Join our trip: ${m.title}`} />}</span></div>
              <div className="group-people">{group.people.map((p) => <span key={p.id}><i>{p.name[0]?.toUpperCase()}</i>{p.name}{p.owner ? " (planner)" : ""}</span>)}</div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{isOwner ? `Send the invite link to the others on this trip (${m.adults + m.childAges.length} travellers). They'll see the trip in their own app, can upload their documents and pay their share from the payment page.` : "You can see this trip, upload your documents and pay your share. The planner approves holds and bookings."}</p>
            </section>
          )}
          <Notices items={notices} />
          <Bookings items={bookings} />
          {visa && (
            <section className="panel" id="visa">
              <div className="hub-sec-head"><h2>Visa</h2></div>
              <VisaPanel missionId={m.id} initial={visa} />
            </section>
          )}
          <section className="panel">
            <div className="hub-sec-head"><h2>Your trip plan</h2><AskAboutMission id={m.id} title={m.title} /></div>
            <ol className="hub-steps">
              {m.tasks.map((t) => (
                <li key={t.kind} className={`st-${t.status}`}>
                  <span className="st-ico" aria-hidden="true">{STATUS[t.status]?.icon ?? "○"}</span>
                  <div>
                    <b>{t.title}</b>
                    <small className="st-label">{STATUS[t.status]?.label ?? t.status}{t.dueDate && t.status !== "done" && t.status !== "skipped" ? ` · by ${fmtDate(t.dueDate)}` : ""}</small>
                    {t.note && <p>{t.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="panel hub-side">
          <h2>What&apos;s happened</h2>
          <ol className="hub-timeline">
            {m.events.map((e, i) => (
              <li key={i}><small>{ACTOR[e.actor] ?? e.actor} · {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</small><p>{e.message}</p></li>
            ))}
          </ol>
          {m.trip && <Link className="btn block" href={`/trips/${m.trip.slug}${m.date ? `?date=${m.date}` : ""}`}>View trip details</Link>}
        </aside>
      </div>
    </div>
  );
}
