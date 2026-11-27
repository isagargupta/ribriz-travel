import Link from "next/link";
import { listClients } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { requireStaff, staffCan } from "@/lib/staff";
import { clientKey } from "@/lib/staff-rules";

export const dynamic = "force-dynamic";

/** Every client: search, who looks after them, what's open, what they've spent. */
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; who?: string }> }) {
  const me = await requireStaff("work");
  const { q, who } = await searchParams;
  const canAll = staffCan(me, "seeAll");
  const scope = who === "all" || (q && canAll) ? "all" : who === "none" ? "none" : "mine";
  const [rows, staff] = await Promise.all([
    listClients({ q, managerId: scope === "mine" && !q ? me.id : scope === "none" ? null : undefined }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const shown = canAll || scope !== "all" ? rows : rows.filter((r) => r.managerId === me.id || !r.managerId);
  const ago = (iso: string) => { const d = Math.round((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

  return (
    <div className="dk">
      <div className="dk-head">
        <div><h1>Clients</h1><p>{scope === "mine" && !q ? "The clients you look after." : scope === "none" ? "Clients without an agent yet." : "Everyone who has asked, booked or signed up."}</p></div>
        <div className="dk-seg">
          <Link href="/admin/clients" className={scope === "mine" && !q ? "on" : ""}>Mine</Link>
          <Link href="/admin/clients?who=none" className={scope === "none" ? "on" : ""}>No agent</Link>
          {canAll && <Link href="/admin/clients?who=all" className={scope === "all" ? "on" : ""}>Everyone</Link>}
        </div>
      </div>
      <form className="dk-search" role="search">
        <input name="q" defaultValue={q ?? ""} placeholder="Search name, email, phone or reference (RB-…)" aria-label="Search clients" />
        <button className="dk-btn primary">Search</button>
      </form>
      {shown.length === 0 ? <div className="dk-card"><div className="dk-empty">{q ? `No clients match “${q}”.` : "No clients here yet."}</div></div> : (
        <table className="dk-table">
          <thead><tr><th>Client</th><th className="hide-sm">Agent</th><th>Open</th><th className="hide-sm">Paid</th><th className="hide-sm">Next trip</th><th className="hide-sm">Last activity</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.email}>
                <td><Link href={`/admin/clients/${clientKey(r.email)}`} className="dk-who"><span className="dk-avatar">{r.name[0]?.toUpperCase()}</span><span>{r.name}<small>{r.email}{r.tags.length ? ` · ${r.tags.join(", ")}` : ""}</small></span></Link></td>
                <td className="hide-sm">{r.managerId ? nameOf.get(r.managerId) ?? "—" : <span className="dk-chip amber">None</span>}</td>
                <td>{r.open ? <span className="dk-chip red">{r.open}</span> : <span className="dk-meta">0</span>}</td>
                <td className="hide-sm">{r.paid ? fmt(r.paid) : "—"}</td>
                <td className="hide-sm">{r.nextTrip ?? "—"}</td>
                <td className="hide-sm dk-meta">{ago(r.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
