import Link from "next/link";
import { notFound } from "next/navigation";
import ClientEmail from "@/components/admin/ClientEmail";
import { addClientNoteAction, addFollowUpAction, doneFollowUpAction, setClientManagerAction, setClientTagsAction } from "../../../actions";
import { clientView } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { TYPE_LABELS } from "@/lib/inbox";
import { fmt } from "@/lib/pricing";
import { requireStaff, staffCan } from "@/lib/staff";
import { clientEmail } from "@/lib/staff-rules";
import { DOC_LABELS, type DocKind } from "@/lib/visa-docs";

export const dynamic = "force-dynamic";
const ist = (d: Date | string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const STATUS: Record<string, string> = { new: "New", contacted: "In progress", booked: "Booked", closed: "Closed" };
const ICON: Record<string, string> = { request: "📥", email: "✉️", whatsapp: "💬", note: "📝", money: "₹", event: "•", doc: "📄" };

/** One client, everything about them: requests, trips, money, documents, history, follow-ups and notes. */
export default async function ClientPage({ params }: { params: Promise<{ key: string }> }) {
  const me = await requireStaff("work");
  const email = clientEmail((await params).key);
  const c = await clientView(email);
  if (!c) notFound();
  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const agent = staff.find((s) => s.id === c.card?.managerId);
  // agents see their own clients and clients without an agent; managers see everyone
  if (!staffCan(me, "seeAll") && c.card?.managerId && c.card.managerId !== me.id) {
    return <div className="dk"><div className="dk-card"><div className="dk-empty">{c.name} is looked after by {agent?.name ?? "another agent"}. Ask a manager if you need to take them over.</div></div></div>;
  }
  const open = c.enquiries.filter((e) => e.status === "new" || e.status === "contacted");
  const docs = c.missions.flatMap((m) => m.documents.map((d) => ({ ...d, trip: m.title })));
  const wa = c.phone.replace(/[^\d]/g, "");
  const prefs = c.profile?.prefs ?? {};

  return (
    <div className="dk">
      <div className="dk-client-head">
        <span className="dk-avatar">{c.name[0]?.toUpperCase()}</span>
        <div>
          <h1>{c.name}</h1>
          <p>{c.email}{c.phone ? ` · ${c.phone}` : ""} · client since {c.since.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}{c.customer ? " · has an account" : ""}</p>
          <div className="dk-tags" style={{ marginTop: 6 }}>{(c.card?.tags ?? "").split(",").filter(Boolean).map((t) => <span key={t} className="dk-chip blue">{t}</span>)}<span className="dk-chip">{agent ? `Agent: ${agent.name}` : "No agent yet"}</span></div>
        </div>
        <div className="dk-contact">
          <a className="dk-btn primary" href="#email">✉️ Email</a>
          {wa && <a className="dk-btn" href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
          <a className="dk-btn" href="#followup">⏰ Follow up</a>
        </div>
      </div>

      <div className="dk-stats">
        <div className="dk-kpi good"><small>Total paid</small><b>{fmt(c.paid)}</b></div>
        <div className={`dk-kpi ${open.length ? "hot" : ""}`}><small>Open requests</small><b>{open.length}</b></div>
        <div className="dk-kpi"><small>Trips &amp; plans</small><b>{c.missions.length}</b></div>
        <div className="dk-kpi warn"><small>To collect</small><b>{fmt(c.dues.reduce((n, d) => n + d.amount, 0))}</b></div>
      </div>

      <div className="dk-grid">
        <div className="dk-col">
          <section className="dk-card">
            <header><h2>Requests</h2><span>{c.enquiries.length}</span></header>
            {c.enquiries.length === 0 ? <div className="dk-empty">No requests yet.</div> : (
              <ul className="dk-list">
                {c.enquiries.map((e) => {
                  const paid = e.payments.reduce((n, p) => n + (["paid", "partially_refunded", "refunded"].includes(p.status) ? p.amount - p.refundedAmount : 0), 0);
                  return (
                    <li key={e.id} className="dk-work" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <div>
                        <b>{TYPE_LABELS[e.type] ?? e.type}{e.tripTitle ? `: ${e.tripTitle}` : ""}</b>
                        <div className="dk-meta"><span className="mono">{e.ref}</span> · {ist(e.createdAt)}{e.departure ? ` · travels ${e.departure}` : ""}{e.assigneeId ? ` · ${staff.find((s) => s.id === e.assigneeId)?.name ?? ""}` : ""}</div>
                        <div className="dk-chips"><span className={`dk-chip ${e.status === "booked" ? "green" : e.status === "new" ? "red" : ""}`}>{STATUS[e.status] ?? e.status}</span>{e.quotedTotal ? <span className="dk-chip">{fmt(e.quotedTotal)}</span> : null}{paid ? <span className="dk-chip green">paid {fmt(paid)}</span> : null}{e.invoices.length ? <span className="dk-chip blue">{e.invoices.length} GST doc{e.invoices.length > 1 ? "s" : ""}</span> : null}</div>
                      </div>
                      <div className="dk-acts"><Link className="dk-btn" href={`/admin/enquiries?q=${e.ref}`}>Open</Link></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {c.missions.length > 0 && (
            <section className="dk-card">
              <header><h2>Trips &amp; plans</h2></header>
              <ul className="dk-list">
                {c.missions.map((m) => {
                  const done = m.tasks.filter((t) => t.status === "done" || t.status === "skipped").length;
                  return (
                    <li key={m.id}>
                      <div className="dk-row"><b>{m.title}</b><span className="dk-meta">{done}/{m.tasks.length} steps</span></div>
                      <div className="dk-bar" style={{ margin: "8px 0" }}><i style={{ width: `${m.tasks.length ? (done / m.tasks.length) * 100 : 0}%` }} /></div>
                      <div className="dk-chips">{m.tasks.map((t) => <span key={t.kind} className={`dk-chip ${t.status === "done" ? "green" : t.status === "needs_approval" ? "amber" : t.status === "waiting" || t.status === "in_progress" ? "blue" : ""}`} title={t.note ?? ""}>{t.title}</span>)}</div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {docs.length > 0 && (
            <section className="dk-card">
              <header><h2>Documents</h2><span>{docs.length}</span></header>
              <ul className="dk-list">{docs.map((d) => <li key={d.id} className="dk-row"><span>{d.status === "ok" ? "✅" : d.status === "checking" ? "⏳" : "⚠️"} <a href={`/api/docs/${d.id}?raw=1`} target="_blank" rel="noopener noreferrer">{DOC_LABELS[d.kind as DocKind] ?? d.kind}</a> <span className="dk-meta">· {d.fileName} · {d.trip}</span></span><span className="dk-meta">{ist(d.createdAt)}</span></li>)}</ul>
            </section>
          )}

          <section className="dk-card">
            <header><h2>History</h2><span>Everything, newest first</span></header>
            {c.timeline.length === 0 ? <div className="dk-empty">Nothing yet.</div> : (
              <ol className="dk-tl">{c.timeline.map((t, i) => <li key={i} className={t.kind}><small>{ICON[t.kind]} {ist(t.at)}{t.by ? ` · ${t.by}` : ""}</small><b>{t.link ? <Link href={t.link}>{t.title}</Link> : t.title}</b>{t.body && <p>{t.body.length > 400 ? t.body.slice(0, 400) + "…" : t.body}</p>}</li>)}</ol>
            )}
          </section>
        </div>

        <div className="dk-col">
          {staffCan(me, "reassign") ? (
            <section className="dk-card">
              <header><h2>Agent</h2></header>
              <form action={setClientManagerAction} className="dk-form" style={{ borderTop: 0 }}>
                <input type="hidden" name="email" value={c.email} />
                <div className="dk-inline"><select className="dk-in" name="staffId" defaultValue={c.card?.managerId ?? ""} style={{ flex: 1 }}><option value="">No agent</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="dk-btn primary">Save</button></div>
                <small className="dk-meta">Their open requests move to the new agent too.</small>
              </form>
            </section>
          ) : null}

          <section className="dk-card" id="followup">
            <header><h2>Follow-ups</h2></header>
            {c.followUps.length === 0 ? <div className="dk-empty">None open.</div> : (
              <ul className="dk-list">{c.followUps.map((f) => <li key={f.id} className="dk-fu"><div><b>{f.title}</b><div className="dk-meta">{ist(f.dueAt)} · {f.staff.name}</div></div><form action={doneFollowUpAction}><input type="hidden" name="id" value={f.id} /><button className="dk-btn">✓ Done</button></form></li>)}</ul>
            )}
            <form action={addFollowUpAction} className="dk-form">
              <input type="hidden" name="email" value={c.email} />
              {open[0] && <input type="hidden" name="enquiryId" value={open[0].id} />}
              <input className="dk-in" name="title" placeholder={`Follow up with ${c.name.split(" ")[0]} about…`} required />
              <div className="dk-inline">
                <select className="dk-in" name="when" defaultValue="tomorrow"><option value="2h">In 2 hours</option><option value="tomorrow">Tomorrow 10am</option><option value="3d">In 3 days</option><option value="week">Next week</option></select>
                <input className="dk-in" type="date" name="date" aria-label="Or pick a date" />
                <button className="dk-btn primary">Add</button>
              </div>
            </form>
          </section>

          <section className="dk-card">
            <header><h2>Email {c.name.split(" ")[0]}</h2></header>
            <ClientEmail email={c.email} name={c.name} />
          </section>

          <section className="dk-card">
            <header><h2>Notes</h2></header>
            <form action={addClientNoteAction} className="dk-form" style={{ borderTop: 0 }}>
              <input type="hidden" name="email" value={c.email} />
              <textarea name="body" placeholder="Something the team should know (preferences, conversations, special dates)…" required />
              <div className="dk-inline" style={{ justifyContent: "flex-end" }}><button className="dk-btn primary">Save note</button></div>
            </form>
          </section>

          <section className="dk-card">
            <header><h2>Tags</h2></header>
            <form action={setClientTagsAction} className="dk-form" style={{ borderTop: 0 }}>
              <input type="hidden" name="email" value={c.email} />
              <div className="dk-inline"><input className="dk-in" name="tags" defaultValue={c.card?.tags.split(",").join(", ") ?? ""} placeholder="vip, honeymoon, corporate" style={{ flex: 1 }} /><button className="dk-btn">Save</button></div>
            </form>
          </section>

          {(Object.keys(prefs).length > 0 || (c.profile?.notes.length ?? 0) > 0) && (
            <section className="dk-card">
              <header><h2>What Riya knows</h2></header>
              <ul className="dk-list">
                {Object.entries(prefs).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => <li key={k} className="dk-row"><span className="dk-meta">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span><b style={{ textAlign: "right" }}>{Array.isArray(v) ? v.join(", ") : String(v)}</b></li>)}
                {c.profile?.notes.map((n, i) => <li key={i} style={{ fontSize: 14 }}>📝 {n.text}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
