import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Trip hub", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; icon: string }> = {
  todo: { label: "To do", icon: "○" }, in_progress: { label: "Riya is on it", icon: "◐" }, needs_approval: { label: "Needs your OK", icon: "!" },
  waiting: { label: "With our team", icon: "◔" }, done: { label: "Done", icon: "✓" }, skipped: { label: "Not needed", icon: "–" },
};
const ACTOR: Record<string, string> = { agent: "Riya", traveller: "You", team: "Ribriz team", system: "Ribriz" };

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await getOwner();
  const m = await missionView(owner, id);
  if (!m) notFound();
  const pending = (await Promise.all(m.approvals.filter((a) => a.status === "pending").map((a) => pendingCard(owner, a.id)))).filter((c) => c !== null);
  const days = m.date ? daysBetween(isoDate(new Date()), m.date) : null;
  const visa = m.trip ? await visaChecklist(owner, m.id) : null;

  return (
    <div className="wrap hub">
      <div className="hub-hero">
        {m.trip && <Image src={m.trip.image} alt="" fill priority sizes="100vw" />}
        <div className="hub-hero-in">
          <Link href="/hub" className="crumbs">← All trips</Link>
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
          {pending.length > 0 && (
            <section className="panel">
              <h2>Waiting for your OK</h2>
              <HubApprovals cards={pending} />
            </section>
          )}
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
              <li key={i}><small>{ACTOR[e.actor] ?? e.actor} · {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small><p>{e.message}</p></li>
            ))}
          </ol>
          {m.trip && <Link className="btn block" href={`/trips/${m.trip.slug}${m.date ? `?date=${m.date}` : ""}`}>View trip details</Link>}
        </aside>
      </div>
    </div>
  );
}
