import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { deleteEnquiry, updateEnquiry } from "../../actions";

const FILTERS = ["all", "new", "contacted", "booked", "closed"];
const TYPE_LABELS: Record<string, string> = { hold: "48-hour price hold", enquiry: "Question about a trip", custom: "Custom trip request", visa: "Visa application help", forex: "Forex order", insurance: "Travel insurance", flight: "Flight booking", hotel: "Hotel booking" };

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const where = FILTERS.includes(status) && status !== "all" ? { status } : {};
  const list = await prisma.enquiry.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { mission: { select: { id: true, documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, fileName: true, status: true, findings: true } } } } },
  });
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
                  <div className="mono muted" style={{ fontSize: 12 }}>{e.ref} · {e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                  <h2 style={{ fontSize: 18, margin: "4px 0" }}>{e.name} <span className={`status ${e.status}`}>{e.status}</span></h2>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ userSelect: "all" }}>{e.phone}</span> · <span style={{ userSelect: "all" }}>{e.email}</span>
                    {" · "}<a href={`https://wa.me/${wa(e.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 14 }}>
                  <b>{TYPE_LABELS[e.type] ?? e.type}</b>{e.missionId && <span className="pill" style={{ marginLeft: 6 }}>via Riya</span>}{e.type === "hold" && e.status === "new" && <><br /><span className={Date.now() - e.createdAt.getTime() > 48 * 3600e3 ? "warn-txt" : "muted"}>{Date.now() - e.createdAt.getTime() > 48 * 3600e3 ? "Hold expired" : `Hold ends ${new Date(e.createdAt.getTime() + 48 * 3600e3).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}</span></>}<br />
                  {e.tripTitle && <span>{e.tripTitle}<br /></span>}
                  <span className="muted">{e.adults} adult{e.adults > 1 ? "s" : ""}{e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}{e.fromCity ? ` · from ${e.fromCity}` : ""}{e.departure ? ` · departs ${e.departure}` : ""}</span>
                  {e.quotedTotal ? <div className="mono" style={{ fontWeight: 700 }}>Quoted {fmt(e.quotedTotal)}</div> : null}
                </div>
              </div>
              {e.travellers && <p style={{ fontSize: 14, margin: "8px 0 0" }}><b>Also travelling:</b> {(JSON.parse(e.travellers) as string[]).join(", ")}</p>}
              {e.childAges && e.children > 0 && <p style={{ fontSize: 14, margin: "4px 0 0" }}><b>Child ages:</b> {(JSON.parse(e.childAges) as number[]).join(", ")}</p>}
              {e.message && <p style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 12, borderRadius: 12, fontSize: 14 }}>{e.message}</p>}
              {e.type === "visa" && e.mission && (
                <div className="admin-docs">
                  <b>Traveller&apos;s documents ({e.mission.documents.length})</b>
                  {e.mission.documents.length === 0 ? <p className="muted" style={{ margin: 0 }}>None uploaded yet.</p> : (
                    <ul>
                      {e.mission.documents.map((d) => (
                        <li key={d.id}>
                          <span className={`vt ${d.status === "ok" ? "good" : d.status === "checking" ? "ok" : "warn"}`}>{d.status === "ok" ? "Checked" : d.status}</span>{" "}
                          <b>{d.kind.replace("_", " ")}</b> · <a href={`/api/docs/${d.id}`} target="_blank" rel="noopener noreferrer">Open {d.fileName}</a>
                          {d.findings && <small className="muted" style={{ display: "block" }}>{(JSON.parse(d.findings) as string[]).join(" ")}</small>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <small className="muted">Links open for 2 minutes. Documents are deleted automatically 30 days after the trip.</small>
                </div>
              )}
              <form action={updateEnquiry} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
                <input type="hidden" name="id" value={e.id} />
                <label className="lab" title="Marking as booked takes seats from the departure">Status
                  <select className="in" name="status" defaultValue={e.status} style={{ width: 150 }}>
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option>
                  </select>
                </label>
                <label className="lab" style={{ flex: 1, minWidth: 200 }}>Internal note
                  <input className="in" name="note" defaultValue={e.note ?? ""} placeholder="e.g. Called, sending quote by email" />
                </label>
                <label className="chk" style={{ fontSize: 13 }} title="Sends the customer an email when the status changes"><input type="checkbox" name="notify" defaultChecked /> Email customer</label>
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
