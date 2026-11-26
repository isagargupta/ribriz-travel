import type { Metadata } from "next";
import Link from "next/link";
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { urgentCount } from "@/lib/inbox";
import { logout } from "../actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const who = await currentAdmin();
  const [fresh, urgent, toModerate] = await Promise.all([prisma.enquiry.count({ where: { status: "new" } }), urgentCount(), prisma.review.count({ where: { status: "pending" } })]);
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link className="logo" href="/admin"><img src="/img/logo.png" alt="Ribriz" style={{ height: 34 }} /></Link>
        <Link href="/admin/inbox">Inbox {urgent > 0 && <span className="badge-count">{urgent}</span>}</Link>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/enquiries">Enquiries {fresh > 0 && <span className="badge-count">{fresh}</span>}</Link>
        <Link href="/admin/invoices">GST invoices</Link>
        <Link href="/admin/reviews">Reviews {toModerate > 0 && <span className="badge-count">{toModerate}</span>}</Link>
        <Link href="/admin/trips">Trips</Link>
        <Link href="/admin/trips/new">+ Add trip</Link>
        <Link href="/admin/subscribers">Subscribers</Link>
        <a href="/" target="_blank" rel="noopener noreferrer">View site ↗</a>
        <form action={logout} style={{ marginTop: "auto", display: "grid", gap: 4 }}>{who && who !== "password" && <small style={{ color: "#a3a9d6", padding: "0 12px", overflow: "hidden", textOverflow: "ellipsis" }}>{who}</small>}<button type="submit">Sign out</button></form>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
