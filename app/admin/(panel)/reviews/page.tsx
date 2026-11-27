import { requireStaff } from "@/lib/staff";
import Link from "next/link";
import Stars from "@/components/Stars";
import { prisma } from "@/lib/db";
import { moderateReview } from "../../actions";

const TABS = ["pending", "published", "rejected"] as const;

export default async function Reviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff("catalogue");
  const { status = "pending" } = await searchParams;
  const tab = (TABS as readonly string[]).includes(status) ? status : "pending";
  const [list, trips] = await Promise.all([
    prisma.review.findMany({ where: { status: tab }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.trip.findMany({ select: { id: true, title: true, slug: true } }),
  ]);
  const tripOf = (id: string) => trips.find((t) => t.id === id);
  return (
    <>
      <div className="admin-head">
        <div><h1>Reviews</h1><p className="muted" style={{ margin: "4px 0 0" }}>From travellers who took the trip with us. Publish as written, or reject only if it isn&apos;t about the trip or breaks the law. Never edit.</p></div>
        <div className="chips">{TABS.map((t) => <Link key={t} href={`/admin/reviews?status=${t}`} className="btn sm" style={t === tab ? { background: "var(--fg)", color: "#fff" } : undefined}>{t[0].toUpperCase() + t.slice(1)}</Link>)}</div>
      </div>
      {list.length === 0 ? <div className="empty">No {tab} reviews.</div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((r) => {
            const t = tripOf(r.tripId);
            return (
              <div key={r.id} className="panel" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><Stars value={r.stars} /> <b>{r.title}</b><div className="muted" style={{ fontSize: 13 }}>{r.displayName} · {t ? <Link href={`/trips/${t.slug}#reviews`}>{t.title}</Link> : "Trip removed"} · travelled {r.travelledOn ?? "?"} · sent {r.createdAt.toLocaleDateString("en-IN")}</div></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {r.status !== "published" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="published" /><button className="btn sm blue">Publish</button></form>}
                    {r.status !== "rejected" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="rejected" /><button className="btn sm danger">Reject</button></form>}
                  </div>
                </div>
                <p style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{r.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
