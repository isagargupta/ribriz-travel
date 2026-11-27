import StaffForm from "@/components/admin/StaffForm";
import { handOverAction } from "../../actions";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { requireStaff, staffCan } from "@/lib/staff";
import { ROLE_LABEL, type Role } from "@/lib/staff-rules";

export const dynamic = "force-dynamic";
const ago = (d: Date | null) => { if (!d) return "never"; const m = Math.round((Date.now() - d.getTime()) / 60000); return m < 5 ? "online now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

/** The team: who's on it, how busy each person is, and moving work between them. */
export default async function Team() {
  const me = await requireStaff("reassign");
  const isOwner = staffCan(me, "team");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [staff, open, urgent, overdue, clients, paid] = await Promise.all([
    prisma.staff.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.enquiry.groupBy({ by: ["assigneeId"], where: { status: { in: ["new", "contacted"] } }, _count: true }),
    prisma.enquiry.groupBy({ by: ["assigneeId"], where: { status: "new", createdAt: { lt: new Date(now.getTime() - 24 * 3600e3) } }, _count: true }),
    prisma.followUp.groupBy({ by: ["staffId"], where: { doneAt: null, dueAt: { lt: now } }, _count: true }),
    prisma.clientCard.groupBy({ by: ["managerId"], _count: true }),
    prisma.payment.findMany({ where: { paidAt: { gte: monthStart }, status: { in: ["paid", "partially_refunded"] } }, select: { amount: true, refundedAmount: true, enquiry: { select: { assigneeId: true } } } }),
  ]);
  const count = <K extends string>(rows: ({ _count: number } & Record<K, string | null>)[], k: K) => new Map(rows.map((r) => [r[k], r._count]));
  const openBy = count(open, "assigneeId"), urgentBy = count(urgent, "assigneeId"), overdueBy = count(overdue, "staffId"), clientsBy = count(clients, "managerId");
  const collected = new Map<string, number>();
  for (const p of paid) { const k = p.enquiry?.assigneeId; if (k) collected.set(k, (collected.get(k) ?? 0) + p.amount - p.refundedAmount); }
  const maxOpen = Math.max(1, ...staff.map((s) => openBy.get(s.id) ?? 0));
  const active = staff.filter((s) => s.active);

  return (
    <div className="dk">
      <div className="dk-head">
        <div><h1>Team</h1><p>{active.length} active · {openBy.get(null) ?? 0} request{openBy.get(null) === 1 ? "" : "s"} waiting in the shared queue</p></div>
      </div>

      <table className="dk-table dk-team">
        <thead><tr><th>Person</th><th>Open</th><th className="hide-sm">Waiting &gt;24h</th><th className="hide-sm">Overdue follow-ups</th><th className="hide-sm">Clients</th><th className="hide-sm">Collected this month</th><th className="hide-sm">Last seen</th></tr></thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} style={s.active ? undefined : { opacity: 0.55 }}>
              <td><div className="dk-who"><span className="dk-avatar">{s.name[0]?.toUpperCase()}</span><span>{s.name} <span className="dk-chip">{ROLE_LABEL[s.role as Role] ?? s.role}</span>{!s.active && <span className="dk-chip">No access</span>}{s.active && !s.takesNew && <span className="dk-chip amber">Not taking new</span>}<small>{s.email}</small></span></div></td>
              <td><div className="dk-inline"><b>{openBy.get(s.id) ?? 0}</b><span className="dk-bar" style={{ width: 80 }}><i style={{ width: `${((openBy.get(s.id) ?? 0) / maxOpen) * 100}%` }} /></span></div></td>
              <td className="hide-sm">{urgentBy.get(s.id) ? <span className="dk-chip red">{urgentBy.get(s.id)}</span> : "0"}</td>
              <td className="hide-sm">{overdueBy.get(s.id) ? <span className="dk-chip amber">{overdueBy.get(s.id)}</span> : "0"}</td>
              <td className="hide-sm">{clientsBy.get(s.id) ?? 0}</td>
              <td className="hide-sm">{collected.get(s.id) ? fmt(collected.get(s.id)!) : "—"}</td>
              <td className="hide-sm dk-meta">{ago(s.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={isOwner ? "dk-grid" : "dk-col"} style={{ marginTop: 18, ...(isOwner ? {} : { maxWidth: 520 }) }}>
        {isOwner && (<div className="dk-col">
          {(
            <section className="dk-card">
              <header><h2>People &amp; access</h2><span>Owners only</span></header>
              <div className="dk-form" style={{ borderTop: 0 }}>
                <b style={{ fontSize: 14 }}>Add an employee</b>
                <StaffForm />
                <small className="dk-meta">They sign in at /admin/login with their email; we send a one-time code. Agents see their own clients and the shared queue. Managers also see everyone&apos;s clients, money, trips and reports. Owners also manage the team.</small>
              </div>
              <ul className="dk-list">
                {staff.map((s) => <li key={s.id}><div className="dk-meta" style={{ marginBottom: 6 }}>{s.email}{s.id === me.id ? " (you)" : ""}</div><StaffForm s={{ id: s.id, name: s.name, email: s.email, role: s.role, active: s.active, takesNew: s.takesNew }} /></li>)}
              </ul>
            </section>
          )}
        </div>)}
        <div className="dk-col">
          <section className="dk-card">
            <header><h2>Hand over work</h2></header>
            <form action={handOverAction} className="dk-form" style={{ borderTop: 0 }}>
              <p className="dk-meta" style={{ margin: 0 }}>Someone on leave or leaving? Move all their open requests, clients and follow-ups to someone else.</p>
              <label className="dk-meta">From<select className="dk-in" name="from" required style={{ width: "100%" }}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({openBy.get(s.id) ?? 0} open)</option>)}</select></label>
              <label className="dk-meta">To<select className="dk-in" name="to" required style={{ width: "100%" }}>{active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <button className="dk-btn primary">Hand over</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
