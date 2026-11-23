import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { shortRef } from "@/lib/validate";
import { deleteEnquiry, updateEnquiry } from "../../actions";

const FILTERS = ["all", "new", "contacted", "booked", "closed"];

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const where = FILTERS.includes(status) && status !== "all" ? { status } : {};
  const list = await prisma.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const wa = (phone: string) => phone.replace(/[^\d]/g, "");

  return (
    <>
      <div className="admin-head">
        <h1>Enquiries</h1>
        <div className="chips">{FILTERS.map((f) => <Link key={f} href={`/admin/enquiries?status=${f}`} className="btn sm" aria-current={f === status ? "page" : undefined} style={f === status ? { background: "var(--fg)", color: "#fff" } : undefined}>{f[0].toUpperCase() + f.slice(1)}</Link>)}</div>
      </div>
      {list.length === 0 ? <div className="empty">No enquiries in this view.</div> : (
        <div style={{ display: "grid", gap: 14 }}>
          {list.map((e) => (
            <div className="panel" id={e.id} key={e.id} style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="mono muted" style={{ fontSize: 12 }}>{shortRef(e.id)} · {e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                  <h2 style={{ fontSize: 18, margin: "4px 0" }}>{e.name} <span className={`status ${e.status}`}>{e.status}</span></h2>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ userSelect: "all" }}>{e.phone}</span> · <span style={{ userSelect: "all" }}>{e.email}</span>
                    {" · "}<a href={`https://wa.me/${wa(e.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 14 }}>
                  <b>{e.type === "custom" ? "Custom trip request" : e.type === "hold" ? "48-hour price hold" : "Question about a trip"}</b><br />
                  {e.tripTitle && <span>{e.tripTitle}<br /></span>}
                  <span className="muted">{e.adults} adult{e.adults > 1 ? "s" : ""}{e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}{e.fromCity ? ` · from ${e.fromCity}` : ""}{e.departure ? ` · departs ${e.departure}` : ""}</span>
                  {e.quotedTotal ? <div className="mono" style={{ fontWeight: 700 }}>Quoted {fmt(e.quotedTotal)}</div> : null}
                </div>
              </div>
              {e.message && <p style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 12, borderRadius: 12, fontSize: 14 }}>{e.message}</p>}
              <form action={updateEnquiry} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
                <input type="hidden" name="id" value={e.id} />
                <label className="lab">Status
                  <select className="in" name="status" defaultValue={e.status} style={{ width: 150 }}>
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option>
                  </select>
                </label>
                <label className="lab" style={{ flex: 1, minWidth: 200 }}>Internal note
                  <input className="in" name="note" defaultValue={e.note ?? ""} placeholder="e.g. Called, sending quote by email" />
                </label>
                <button className="btn blue" type="submit">Save</button>
              </form>
              <form action={deleteEnquiry} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={e.id} />
                <button className="btn sm danger" type="submit">Delete enquiry</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
