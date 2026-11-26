import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { creditNoteAction, deleteEnquiry, issueInvoiceAction, setBillingAction, updateEnquiry } from "../../actions";
import { DOC_TITLE, inr, type DocKind } from "@/lib/gst-rules";
import OffersPanel from "@/components/admin/OffersPanel";
import PaymentsPanel from "@/components/admin/PaymentsPanel";
import { inrFor } from "@/lib/fx";
import { detailLines } from "@/lib/service-fields";
import { payUrl } from "@/lib/payments";

const SERVICE_TYPES = ["custom", "visa", "forex", "insurance", "flight", "hotel"];

/** Market-rate hint for the team when quoting forex. */
async function forexHint(details: string | null) {
  const d = details ? (JSON.parse(details) as Record<string, unknown>) : {};
  const amount = Number(String(d.amount ?? "").replace(/[^\d.]/g, ""));
  const fx = d.currency ? await inrFor(String(d.currency), amount || 1) : null;
  return fx ? `Market rate today: 1 ${String(d.currency).toUpperCase()} = ₹${fx.rate.toFixed(fx.rate < 1 ? 4 : 2)}${amount ? ` · ${amount.toLocaleString("en-IN")} ≈ ₹${fx.inr.toLocaleString("en-IN")}` : ""} (before partner margin)` : null;
}

const FILTERS = ["all", "new", "contacted", "booked", "closed"];
const TYPE_LABELS: Record<string, string> = { hold: "48-hour price hold", enquiry: "Question about a trip", custom: "Custom trip request", visa: "Visa application help", forex: "Forex order", insurance: "Travel insurance", flight: "Flight booking", hotel: "Hotel booking" };

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const where = FILTERS.includes(status) && status !== "all" ? { status } : {};
  const list = await prisma.enquiry.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { invoices: { orderBy: { issuedAt: "asc" } }, payments: { orderBy: { createdAt: "asc" } }, offers: { orderBy: { createdAt: "asc" } }, messages: { orderBy: { createdAt: "desc" }, take: 10 }, mission: { select: { id: true, documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, fileName: true, status: true, findings: true } } } } },
  });
  const wa = (phone: string) => phone.replace(/[^\d]/g, "");
  const hints = new Map(await Promise.all(list.filter((e) => e.type === "forex").map(async (e) => [e.id, await forexHint(e.details)] as const)));

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
              {e.details && SERVICE_TYPES.includes(e.type) ? (
                <ul className="admin-details">{detailLines(e.type, JSON.parse(e.details)).map((l) => <li key={l}>{l}</li>)}</ul>
              ) : e.message && <p style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 12, borderRadius: 12, fontSize: 14 }}>{e.message}</p>}
              {SERVICE_TYPES.includes(e.type) && (
                <OffersPanel
                  enquiryId={e.id} canSend={!!e.missionId && e.status !== "closed"} hint={hints.get(e.id) ?? null}
                  offers={e.offers.map((o) => ({ id: o.id, title: o.title, lines: JSON.parse(o.lines), priceInr: o.priceInr, status: o.status === "offered" && o.validUntil < new Date() ? "expired" : o.status, confirmation: o.confirmation, validUntil: o.validUntil.toISOString() }))}
                />
              )}
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
              {e.quotedTotal ? <p style={{ fontSize: 13, margin: "8px 0 0" }}><b>Customer pay link:</b> <code style={{ userSelect: "all" }}>{(process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "") + payUrl(e.ref)}</code></p> : null}
              {(e.type === "hold" || e.type === "custom") && (
                <div className="admin-docs">
                  <b>GST invoice</b>
                  {e.invoices.length > 0 ? (
                    <ul>
                      {e.invoices.map((iv) => <li key={iv.id}><a href={`/invoice/${iv.id}`} target="_blank" rel="noopener noreferrer" className="mono">{iv.number}</a> · {(DOC_TITLE[iv.kind as DocKind] ?? iv.kind).toLowerCase()} · {inr(iv.total)}{iv.buyerGstin ? ` · ${iv.buyerGstin}` : ""}{iv.emailedAt ? " · emailed" : ""}</li>)}
                    </ul>
                  ) : <p className="muted" style={{ margin: "4px 0" }}>Not issued yet. It's issued automatically when the trip is fully paid.</p>}
                  {!e.invoices.some((iv) => iv.kind === "invoice") ? (
                    <>
                      <form action={setBillingAction} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <input className="in" name="gstin" defaultValue={e.billingGstin ?? ""} placeholder="Buyer GSTIN (business)" style={{ width: 190 }} />
                        <input className="in" name="name" defaultValue={e.billingName ?? ""} placeholder="Registered name" style={{ width: 200 }} />
                        <input className="in" name="address" defaultValue={e.billingAddress ?? ""} placeholder="Billing address" style={{ flex: 1, minWidth: 200 }} />
                        <button className="btn sm" type="submit">Save GST details</button>
                      </form>
                      {e.payments.some((p) => p.status === "paid" || p.status === "partially_refunded") && (
                        <form action={issueInvoiceAction} style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="btn sm blue" type="submit">Issue invoice now for the amount paid</button>
                          <label className="chk" style={{ fontSize: 13 }}><input type="checkbox" name="email" defaultChecked /> Email it</label>
                        </form>
                      )}
                    </>
                  ) : (
                    <form action={creditNoteAction} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      <input type="hidden" name="invoiceId" value={e.invoices.find((iv) => iv.kind === "invoice")!.id} />
                      <input className="in" name="amount" inputMode="decimal" placeholder="Credit ₹" style={{ width: 110 }} />
                      <input className="in" name="reason" placeholder="Reason (refunds make one automatically)" style={{ flex: 1, minWidth: 220 }} />
                      <label className="chk" style={{ fontSize: 13 }}><input type="checkbox" name="email" defaultChecked /> Email it</label>
                      <button className="btn sm" type="submit">Issue credit note</button>
                    </form>
                  )}
                </div>
              )}
              <PaymentsPanel total={e.quotedTotal ?? 0} payments={e.payments.map((p) => ({ id: p.id, kind: p.kind, amount: p.amount, status: p.status, method: p.method, paymentId: p.paymentId, paidAt: p.paidAt?.toISOString() ?? null, refunded: p.refundedAmount }))} />
              {e.messages.length > 0 && (
                <ul className="ib-hist" style={{ marginTop: 10 }}>
                  {e.messages.map((m) => (
                    <li key={m.id}><span className={`ch ch-${m.channel}`}>{m.channel === "note" ? "Note" : m.channel === "email" ? "Email" : "WhatsApp"}</span> {m.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} · {m.author.split("@")[0]} · {m.subject ? <b>{m.subject}</b> : null} {m.body.slice(0, 160)}{m.body.length > 160 ? "…" : ""}</li>
                  ))}
                </ul>
              )}
              <form action={updateEnquiry} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
                <input type="hidden" name="id" value={e.id} />
                <label className="lab" title="Marking as booked takes seats from the departure">Status
                  <select className="in" name="status" defaultValue={e.status} style={{ width: 150 }}>
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option>
                  </select>
                </label>
                <label className="lab" title="What the customer pays online at their pay link. Locked once a payment is made.">Price for online payment (₹)
                  <input className="in" name="total" inputMode="numeric" defaultValue={e.quotedTotal ?? ""} placeholder="e.g. 85000" style={{ width: 150 }} disabled={e.payments.some((p) => p.status !== "created")} />
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
