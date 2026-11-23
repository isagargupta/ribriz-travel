import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "../actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const fresh = await prisma.enquiry.count({ where: { status: "new" } });
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link className="logo" href="/admin"><img src="/img/logo.png" alt="Ribriz" style={{ height: 34 }} /></Link>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/enquiries">Enquiries {fresh > 0 && <span className="badge-count">{fresh}</span>}</Link>
        <Link href="/admin/trips">Trips</Link>
        <Link href="/admin/trips/new">+ Add trip</Link>
        <Link href="/admin/subscribers">Subscribers</Link>
        <a href="/" target="_blank" rel="noopener noreferrer">View site ↗</a>
        <form action={logout} style={{ marginTop: "auto" }}><button type="submit">Sign out</button></form>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
