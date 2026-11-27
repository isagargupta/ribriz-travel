import { requireStaff } from "@/lib/staff";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { runAgentsNow } from "../../actions";
import { inbox } from "@/lib/inbox";

const KIND_LABEL: Record<string, string> = { price_drop: "price drops", hold_expiring: "holds ending", hold_expired: "holds ended", visa_deadline: "visa deadlines", docs_missing: "missing documents", sold_out: "sold-out dates", pre_trip: "pre-trip checklists" };

export default async function Overview() {
  await requireStaff("reports");
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [fresh, week, booked, trips, subs, recent, pipeline, lastRun, watches, alertsWeek] = await Promise.all([
    prisma.enquiry.count({ where: { status: "new" } }),
    prisma.enquiry.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.enquiry.count({ where: { status: "booked" } }),
    prisma.trip.count({ where: { published: true } }),
    prisma.subscriber.count(),
    prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.enquiry.aggregate({ _sum: { quotedTotal: true }, where: { status: { in: ["new", "contacted"] } } }),
    prisma.agentRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.priceWatch.count({ where: { active: true } }),
    prisma.notification.groupBy({ by: ["kind"], _count: true, where: { createdAt: { gte: weekAgo } } }),
  ]);
  const work = await inbox();
  const hot = work.filter((r) => r.work.level === "urgent" || r.work.level === "today");
  const stats = lastRun?.stats ? (JSON.parse(lastRun.stats) as { new?: number; emailsSent?: number; aiWritten?: number }) : null;

  return (
    <>
      <h1>Business overview</h1>
      <div className="kpis">
        <div className="kpi"><b>{fresh}</b><span>new enquiries to answer</span></div>
        <div className="kpi"><b>{week}</b><span>enquiries in the last 7 days</span></div>
        <div className="kpi"><b>{booked}</b><span>marked as booked</span></div>
        <div className="kpi"><b>{fmt(pipeline._sum.quotedTotal ?? 0)}</b><span>open quotes (new + contacted)</span></div>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>{trips} trips on sale · {subs} newsletter subscribers</p>

      <Link href="/admin/inbox" className="agent-card inbox-card">
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>{hot.length ? `${hot.length} request${hot.length > 1 ? "s" : ""} need you today` : "Inbox is under control"}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>{hot.length ? `Top: ${hot[0].name}, ${hot[0].work.next.toLowerCase()}${hot[0].work.reasons[0] ? ` (${hot[0].work.reasons[0].toLowerCase()})` : ""}.` : `${work.length} open request${work.length === 1 ? "" : "s"}, none urgent.`} Riya drafts every reply.</p>
        </div>
        <span className="btn sm">Open inbox →</span>
      </Link>

      <section className="agent-card">
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Riya's background agent</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Checks every open trip daily at 08:00 IST: price drops, holds ending, visa deadlines, missing documents, sold-out dates and pre-trip checklists, then sends each traveller one note.
          </p>
          <p style={{ margin: "8px 0 0" }}>
            {lastRun ? (
              <>Last run {lastRun.startedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                {lastRun.error ? <span className="status closed" style={{ marginLeft: 8 }}>error</span> : !lastRun.finishedAt ? " (running)" : stats ? `: ${stats.new ?? 0} new alerts, ${stats.emailsSent ?? 0} emails${stats.aiWritten ? ` (${stats.aiWritten} written by Riya)` : ""}` : ""}
              </>
            ) : "Not run yet."}
            {" · "}{watches} active price alerts
          </p>
          {alertsWeek.length > 0 && <p className="muted" style={{ margin: "4px 0 0" }}>This week: {alertsWeek.map((a) => `${a._count} ${KIND_LABEL[a.kind] ?? a.kind}`).join(", ")}</p>}
          {lastRun?.error && <p className="muted" style={{ margin: "4px 0 0" }}>{lastRun.error}</p>}
        </div>
        <form action={runAgentsNow}><button className="btn sm">Run agents now</button></form>
      </section>

      <div className="admin-head" style={{ marginTop: 18 }}><h2 style={{ fontSize: 20 }}>Latest enquiries</h2><Link className="btn sm" href="/admin/enquiries">See all</Link></div>
      {recent.length === 0 ? (
        <div className="empty">No enquiries yet. They appear here when customers hold a price, ask a question or request a custom trip.</div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Ref</th><th>Customer</th><th>Type</th><th>Trip</th><th>Quote</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td className="mono"><Link href={`/admin/enquiries#${e.id}`}>{e.ref}</Link></td>
                  <td><b>{e.name}</b><br /><span className="muted">{e.phone}</span></td>
                  <td style={{ textTransform: "capitalize" }}>{({ hold: "Price hold", custom: "Custom trip", enquiry: "Question" } as Record<string, string>)[e.type] ?? e.type}</td>
                  <td>{e.tripTitle ?? "—"}</td>
                  <td className="mono">{e.quotedTotal ? fmt(e.quotedTotal) : "—"}</td>
                  <td><span className={`status ${e.status}`}>{e.status}</span></td>
                  <td className="muted">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
