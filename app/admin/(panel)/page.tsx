import Link from "next/link";
import { addFollowUpAction, claimAction, doneFollowUpAction, reassignAction, snoozeFollowUpAction } from "../actions";
import { desk } from "@/lib/desk";
import { TYPE_LABELS } from "@/lib/inbox";
import { fmt } from "@/lib/pricing";
import { requireStaff, staffCan } from "@/lib/staff";
import { clientKey } from "@/lib/staff-rules";

export const dynamic = "force-dynamic";
const LEVEL: Record<string, string> = { urgent: "Urgent", today: "Today", soon: "Soon", fyi: "Waiting" };
const ist = (iso: string | Date, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) => new Date(iso).toLocaleString("en-IN", { ...o, timeZone: "Asia/Kolkata" });
const hello = () => { const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const DENIED: Record<string, string> = { money: "refunds and invoices", catalogue: "trips and the visa catalogue", reports: "reports", team: "the team", deleteRecords: "deleting records", reassign: "reassigning work", seeAll: "everyone's work" };

/** My desk: what this employee should do now, their follow-ups, money to collect and client activity. */
export default async function MyDesk({ searchParams }: { searchParams: Promise<{ scope?: string; denied?: string }> }) {
  const me = await requireStaff("work");
  const sp = await searchParams;
  const team = sp.scope === "team" && staffCan(me, "seeAll");
  const d = await desk(me, team ? "team" : "mine");
  const manager = staffCan(me, "reassign");
  const buckets = (["overdue", "today", "upcoming"] as const).map((b) => [b, d.followUps.filter((f) => f.bucket === b)] as const).filter(([, l]) => l.length);

  return (
    <div className="dk">
      {sp.denied && <div className="notice warn" style={{ marginBottom: 14 }}>Your role doesn&apos;t include {DENIED[sp.denied] ?? "that page"}. Ask an owner if you need it.</div>}
      <div className="dk-head">
        <div><h1>{hello()}, {me.name.split(" ")[0]}</h1><p>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })} · {team ? "the whole team's work" : "your clients and your queue"}</p></div>
        {staffCan(me, "seeAll") && <div className="dk-seg"><Link href="/admin" className={team ? "" : "on"}>My work</Link><Link href="/admin?scope=team" className={team ? "on" : ""}>Team</Link></div>}
      </div>

      <div className="dk-kpis">
        <a className="dk-kpi" href="#work"><small>Open requests</small><b>{d.kpis.open}</b></a>
        <a className={`dk-kpi ${d.kpis.urgent ? "hot" : ""}`} href="#work"><small>Urgent</small><b>{d.kpis.urgent}</b></a>
        <a className={`dk-kpi ${d.kpis.followToday ? "warn" : ""}`} href="#followups"><small>Follow-ups due</small><b>{d.kpis.followToday}</b></a>
        <a className="dk-kpi" href="#collect"><small>To collect</small><b>{fmt(d.kpis.collect)}</b></a>
        <a className="dk-kpi" href="#departures"><small>Departing in 30 days</small><b>{d.kpis.departing}</b></a>
        <div className="dk-kpi good"><small>Collected this month</small><b>{fmt(d.kpis.revenue)}</b></div>
      </div>

      <div className="dk-grid">
        <div className="dk-col">
          <section className="dk-card" id="work">
            <header><h2>Do next</h2><span>{d.work.length ? "Most urgent first" : ""}</span></header>
            {d.work.length === 0 ? <div className="dk-empty">Nothing waiting on you. New requests from your clients land here.</div> : (
              <ol className="dk-list">
                {d.work.slice(0, 25).map((r) => (
                  <li key={r.id} className="dk-work">
                    <span className={`dk-dot ${r.work.level}`} title={LEVEL[r.work.level]} />
                    <div className="dk-work-main">
                      <b><Link href={`/admin/clients/${clientKey(r.email)}`}>{r.name}</Link></b>
                      <div className="dk-meta">{TYPE_LABELS[r.type] ?? r.type}{r.tripTitle ? ` · ${r.tripTitle}` : ""}{r.quotedTotal ? ` · ${fmt(r.quotedTotal)}` : ""} · <span className="mono">{r.ref}</span>{team && r.assigneeId ? ` · ${d.nameOf[r.assigneeId] ?? ""}` : ""}</div>
                      <p className="dk-next"><strong>Next:</strong> {r.work.next}{r.work.due && r.status === "new" ? <span className="dk-meta"> · reply by {ist(r.work.due)}</span> : null}</p>
                      <div className="dk-chips">{r.work.reasons.map((x) => <span key={x} className={`dk-chip ${/overdue|ends in|Leaves/.test(x) ? "red" : /chose|checked/.test(x) ? "green" : ""}`}>{x}</span>)}</div>
                    </div>
                    <div className="dk-acts">
                      <Link className="dk-btn primary" href={`/admin/inbox#${r.id}`}>Reply</Link>
                      <Link className="dk-btn" href={`/admin/enquiries?q=${r.ref}`}>Open</Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="dk-card" id="queue">
            <header><h2>Shared queue</h2><span>{d.queue.length ? `${d.queue.length} waiting for someone` : "Empty"}</span></header>
            {d.queue.length === 0 ? <div className="dk-empty">Every request has an owner. New clients are assigned automatically to whoever has the lightest load.</div> : (
              <ol className="dk-list">
                {d.queue.map((r) => (
                  <li key={r.id} className="dk-work">
                    <span className={`dk-dot ${r.work.level}`} />
                    <div className="dk-work-main">
                      <b><Link href={`/admin/clients/${clientKey(r.email)}`}>{r.name}</Link></b>
                      <div className="dk-meta">{TYPE_LABELS[r.type] ?? r.type}{r.tripTitle ? ` · ${r.tripTitle}` : ""} · {r.work.reasons[0] ?? ""}</div>
                    </div>
                    <div className="dk-acts">
                      <form action={claimAction}><input type="hidden" name="id" value={r.id} /><button className="dk-btn primary">Take it</button></form>
                      {manager && (
                        <form action={reassignAction} className="dk-inline">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="client" value="on" />
                          <select name="staffId" className="dk-in" aria-label="Assign to">{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                          <button className="dk-btn">Assign</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="dk-card" id="departures">
            <header><h2>Departing soon</h2><span>Next 30 days</span></header>
            {d.departures.length === 0 ? <div className="dk-empty">No booked trips leaving in the next 30 days.</div> : (
              <ul className="dk-list">{d.departures.map((x) => <li key={x.id} className="dk-row"><span><Link href={`/admin/clients/${clientKey(x.email)}`}>{x.name}</Link> <span className="dk-meta">· {x.title}{team && x.assignee ? ` · ${x.assignee}` : ""}</span></span><span className="dk-chip blue">{ist(x.date + "T06:00:00Z", { weekday: "short", day: "numeric", month: "short" })}</span></li>)}</ul>
            )}
          </section>
        </div>

        <div className="dk-col">
          <section className="dk-card" id="followups">
            <header><h2>Follow-ups</h2><span>{d.followUps.length || ""}</span></header>
            {buckets.length === 0 ? <div className="dk-empty">No follow-ups. Add one from any client page, or below.</div> : buckets.map(([b, list]) => (
              <div key={b}>
                <div className={`dk-bucket ${b}`}>{b === "overdue" ? "Overdue" : b === "today" ? "Today" : "Coming up"}</div>
                <ul className="dk-list">
                  {list.map((f) => (
                    <li key={f.id} className="dk-fu">
                      <div><b>{f.title}</b><div className="dk-meta"><Link href={`/admin/clients/${clientKey(f.email)}`}>{f.client}</Link> · {ist(f.dueAt)}{team ? ` · ${f.staff}` : ""}</div></div>
                      <div className="dk-acts">
                        <form action={doneFollowUpAction}><input type="hidden" name="id" value={f.id} /><button className="dk-btn" title="Mark done">✓ Done</button></form>
                        <form action={snoozeFollowUpAction}><input type="hidden" name="id" value={f.id} /><button className="dk-btn ghost" title="Move to tomorrow 10am">Tomorrow</button></form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <form action={addFollowUpAction} className="dk-form">
              <input className="dk-in" name="title" placeholder="Follow up about…" required />
              <div className="dk-inline">
                <input className="dk-in" name="email" type="email" placeholder="Client email" required style={{ flex: 1 }} />
                <select className="dk-in" name="when" defaultValue="tomorrow"><option value="2h">In 2 hours</option><option value="tomorrow">Tomorrow 10am</option><option value="3d">In 3 days</option><option value="week">Next week</option></select>
                <button className="dk-btn primary">Add</button>
              </div>
            </form>
          </section>

          <section className="dk-card" id="collect">
            <header><h2>Money to collect</h2><span>{fmt(d.kpis.collect)}</span></header>
            {d.dues.length === 0 ? <div className="dk-empty">Nothing waiting to be paid.</div> : (
              <ul className="dk-list">{d.dues.slice(0, 10).map((x) => <li key={x.id} className="dk-row"><span><Link href={`/admin/clients/${clientKey(x.email)}`}>{x.name}</Link><span className="dk-meta"> · {x.kind}{x.due ? ` · due ${x.due}` : ""}</span></span><b>{fmt(x.amount)}</b></li>)}</ul>
            )}
          </section>

          <section className="dk-card">
            <header><h2>Client activity</h2><span>Last 7 days</span></header>
            {d.activity.length === 0 ? <div className="dk-empty">No client activity this week.</div> : (
              <ul className="dk-list dk-feed">{d.activity.map((a, i) => <li key={i}><i className={a.kind}>{a.kind === "money" ? "₹" : "•"}</i><span><b>{a.who}</b> {a.text}<div className="dk-meta">{ist(a.at)}</div></span></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
