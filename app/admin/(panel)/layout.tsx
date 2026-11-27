import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { inboxNow } from "@/lib/inbox";
import { requireStaff, staffCan } from "@/lib/staff";
import { ROLE_LABEL, type Role } from "@/lib/staff-rules";
import { logout } from "../actions";
import "./desk.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The staff workspace: menu by role, with live counts for this employee. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff("work");
  const [rows, toModerate, followDue] = await Promise.all([
    inboxNow(),
    staffCan(me, "catalogue") ? prisma.review.count({ where: { status: "pending" } }) : Promise.resolve(0),
    prisma.followUp.count({ where: { staffId: me.id, doneAt: null, dueAt: { lte: new Date(Date.now() + 12 * 3600e3) } } }),
  ]);
  const mineHot = rows.filter((r) => r.assigneeId === me.id && (r.work.level === "urgent" || r.work.level === "today")).length;
  const queue = rows.filter((r) => !r.assigneeId).length;
  const C = ({ n, hot }: { n: number; hot?: boolean }) => (n > 0 ? <span className="badge-count" style={hot ? undefined : { background: "rgba(255,255,255,.18)" }}>{n}</span> : null);

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link className="logo" href="/admin"><img src="/img/logo.png" alt="Ribriz" style={{ height: 34 }} /></Link>
        <small className="adm-group">Work</small>
        <Link href="/admin">My desk <C n={mineHot + followDue} hot /></Link>
        <Link href="/admin/inbox">Inbox <C n={queue} /></Link>
        <Link href="/admin/clients">Clients</Link>
        <Link href="/admin/enquiries">All requests</Link>
        {staffCan(me, "reports") && (<>
          <small className="adm-group">Business</small>
          <Link href="/admin/overview">Overview</Link>
          <Link href="/admin/funnel">Sales funnel</Link>
          <Link href="/admin/invoices">GST documents</Link>
        </>)}
        {staffCan(me, "catalogue") && (<>
          <small className="adm-group">Catalogue</small>
          <Link href="/admin/trips">Trips</Link>
          <Link href="/admin/visas">Visas</Link>
          <Link href="/admin/reviews">Reviews <C n={toModerate} hot /></Link>
          <Link href="/admin/subscribers">Subscribers</Link>
        </>)}
        {staffCan(me, "reports") && (<>
          <small className="adm-group">Team</small>
          <Link href="/admin/team">{staffCan(me, "team") ? "Team & access" : "Team"}</Link>
          <Link href="/admin/health">System health</Link>
        </>)}
        <a href="/" target="_blank" rel="noopener noreferrer">View site ↗</a>
        <form action={logout} style={{ marginTop: "auto", display: "grid", gap: 4 }}>
          <small style={{ color: "#e3e6ff", padding: "0 12px", fontWeight: 700 }}>{me.name}</small>
          <small style={{ color: "#a3a9d6", padding: "0 12px", overflow: "hidden", textOverflow: "ellipsis" }}>{ROLE_LABEL[me.role as Role]}{me.email.endsWith(".local") ? "" : ` · ${me.email}`}</small>
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
