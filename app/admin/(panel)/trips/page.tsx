import Link from "next/link";
import { prisma } from "@/lib/db";
import { KINDS, fmt } from "@/lib/pricing";
import { togglePublished } from "../../actions";

export default async function AdminTrips({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const trips = await prisma.trip.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { enquiries: true } } } });
  return (
    <>
      <div className="admin-head"><h1>Trips</h1><Link className="btn hot" href="/admin/trips/new">+ Add trip</Link></div>
      {sp.saved && <div className="notice ok" style={{ marginBottom: 14 }}>Trip saved. Changes are live on the site.</div>}
      {sp.deleted && <div className="notice ok" style={{ marginBottom: 14 }}>Trip deleted.</div>}
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th></th><th>Trip</th><th>Type</th><th>Nights</th><th>Price / person</th><th>Enquiries</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td><img src={t.image} alt="" /></td>
                <td><b>{t.title}</b><br /><span className="muted">{t.dest}, {t.country}</span>
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {t.featured && <span className="pill">Trending</span>}{t.lastMinute && <span className="pill">Last minute</span>}{t.earlyBird && <span className="pill">Early bird</span>}
                  </div>
                </td>
                <td>{KINDS[t.kind] ?? t.kind}</td>
                <td className="mono">{t.nights}</td>
                <td className="mono">{fmt(t.price)}</td>
                <td className="mono">{t._count.enquiries}</td>
                <td>
                  <form action={togglePublished}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={`status ${t.published ? "booked" : "closed"}`} style={{ border: 0, cursor: "pointer" }} title="Click to switch">{t.published ? "On sale" : "Hidden"}</button>
                  </form>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn sm" href={`/admin/trips/${t.id}`}>Edit</Link>{" "}
                  {t.published && <Link className="btn sm" href={`/trips/${t.slug}`} target="_blank">View</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
