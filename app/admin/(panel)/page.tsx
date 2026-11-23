import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";

export default async function Dashboard() {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [fresh, week, booked, trips, subs, recent, pipeline] = await Promise.all([
    prisma.enquiry.count({ where: { status: "new" } }),
    prisma.enquiry.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.enquiry.count({ where: { status: "booked" } }),
    prisma.trip.count({ where: { published: true } }),
    prisma.subscriber.count(),
    prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.enquiry.aggregate({ _sum: { quotedTotal: true }, where: { status: { in: ["new", "contacted"] } } }),
  ]);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="kpis">
        <div className="kpi"><b>{fresh}</b><span>new enquiries to answer</span></div>
        <div className="kpi"><b>{week}</b><span>enquiries in the last 7 days</span></div>
        <div className="kpi"><b>{booked}</b><span>marked as booked</span></div>
        <div className="kpi"><b>{fmt(pipeline._sum.quotedTotal ?? 0)}</b><span>open quotes (new + contacted)</span></div>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>{trips} trips on sale · {subs} newsletter subscribers</p>

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
                  <td style={{ textTransform: "capitalize" }}>{e.type === "custom" ? "Custom trip" : e.type === "hold" ? "Price hold" : "Question"}</td>
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
