import { prisma } from "@/lib/db";
import { fmt, fmtDate, isoDate } from "@/lib/pricing";
import { addDeparture, deleteDeparture, generateDepartures, updateDeparture } from "@/app/admin/actions";

/** Departure dates for one trip: edit price change, seats and status, or generate a schedule. */
export default async function Departures({ tripId, base, kind }: { tripId: string; base: number; kind: string }) {
  const today = isoDate(new Date());
  const deps = await prisma.departure.findMany({
    where: { tripId, date: { gte: today } },
    orderBy: { date: "asc" },
    include: { _count: { select: { enquiries: true } } },
  });

  return (
    <section className="panel" id="departures" style={{ marginTop: 18 }}>
      <div className="admin-head" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Departure dates <span className="muted" style={{ fontSize: 14 }}>({deps.length} upcoming)</span></h2>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Each date&apos;s price is the base price ({fmt(base)}) plus its price change. Leave seats empty for unlimited.
        Seats go down automatically when you mark an enquiry as booked.
      </p>

      <div className="dep-tools">
        <form action={generateDepartures} className="inline-form">
          <input type="hidden" name="tripId" value={tripId} />
          <b>Fill calendar:</b>
          <label>every <input className="in xs" name="every" type="number" min={1} max={60} defaultValue={kind === "escorted" ? 10 : kind === "cruise" ? 7 : 3} /> days</label>
          <label>for <input className="in xs" name="months" type="number" min={1} max={18} defaultValue={6} /> months</label>
          <label>seats <input className="in xs" name="seats" type="number" min={1} placeholder="∞" defaultValue={kind === "escorted" ? 30 : ""} /></label>
          <button className="btn blue sm">Generate</button>
        </form>
        <form action={addDeparture} className="inline-form">
          <input type="hidden" name="tripId" value={tripId} />
          <b>Add one:</b>
          <input className="in" name="date" type="date" min={today} required aria-label="Date" />
          <label>±₹ <input className="in sm" name="delta" type="number" step={100} defaultValue={0} /></label>
          <label>seats <input className="in xs" name="seats" type="number" min={0} placeholder="∞" /></label>
          <button className="btn sm">Add date</button>
        </form>
      </div>

      {deps.length === 0 ? <div className="empty">No upcoming dates. Generate a schedule above so customers can reserve.</div> : (
        <div className="table-wrap" style={{ maxHeight: 520, overflow: "auto" }}>
          <table className="admin-table dep-table">
            <thead><tr><th>Date</th><th>Price change (₹)</th><th>Adult price</th><th>Seats left</th><th>Status</th><th>Enquiries</th><th /></tr></thead>
            <tbody>
              {deps.map((d) => (
                <tr key={d.id} className={d.status === "closed" ? "closed-row" : ""}>
                  <td className="mono">{fmtDate(d.date, { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</td>
                  <td colSpan={4}>
                    <form action={updateDeparture} className="inline-form tight" id={`f-${d.id}`}>
                      <input type="hidden" name="id" value={d.id} />
                      <input className="in sm" name="delta" type="number" step={100} defaultValue={d.priceDelta} aria-label="Price change" />
                      <span className="mono muted" style={{ minWidth: 90 }}>{fmt(base + d.priceDelta)}</span>
                      <input className="in xs" name="seats" type="number" min={0} defaultValue={d.seatsLeft ?? ""} placeholder="∞" aria-label="Seats left" />
                      <select className="in sm" name="status" defaultValue={d.status} aria-label="Status"><option value="open">Open</option><option value="closed">Closed</option></select>
                      <button className="btn sm">Save</button>
                    </form>
                  </td>
                  <td className="mono">{d._count.enquiries}</td>
                  <td>
                    <form action={deleteDeparture}><input type="hidden" name="id" value={d.id} /><button className="btn sm danger" title="Delete this date">✕</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
