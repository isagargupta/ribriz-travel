import { requireStaff, staffCan } from "@/lib/staff";
import { clientKey } from "@/lib/staff-rules";
import Link from "next/link";
import Copilot from "@/components/admin/Copilot";
import { prisma } from "@/lib/db";
import { TYPE_LABELS, inboxNow } from "@/lib/inbox";
import { fmt } from "@/lib/pricing";

const LEVEL: Record<string, string> = { urgent: "Urgent", today: "Today", soon: "Soon", fyi: "Waiting" };
const t = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Inbox({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const me = await requireStaff("work");
  const { who: whoRaw } = await searchParams;
  const canAll = staffCan(me, "seeAll");
  const who = whoRaw === "queue" ? "queue" : whoRaw === "all" && canAll ? "all" : "mine";
  const all = await inboxNow();
  const rows = all.filter((r) => (who === "all" ? true : who === "queue" ? !r.assigneeId : r.assigneeId === me.id));
  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const history = await prisma.teamMessage.findMany({ where: { enquiryId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: "desc" } });
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.work.level] = (m[r.work.level] ?? 0) + 1), m), {});

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Open requests, most urgent first. Riya drafts each reply; you check it and send.</p>
        </div>
        <div className="dk-seg" style={{ alignSelf: "center" }}>
          <Link href="/admin/inbox" className={who === "mine" ? "on" : ""}>Mine ({all.filter((r) => r.assigneeId === me.id).length})</Link>
          <Link href="/admin/inbox?who=queue" className={who === "queue" ? "on" : ""}>Shared queue ({all.filter((r) => !r.assigneeId).length})</Link>
          {canAll && <Link href="/admin/inbox?who=all" className={who === "all" ? "on" : ""}>Everyone ({all.length})</Link>}
        </div>
        <div className="inbox-counts">{(["urgent", "today", "soon", "fyi"] as const).map((l) => <span key={l} className={`lvl lvl-${l}`}>{counts[l] ?? 0} {LEVEL[l].toLowerCase()}</span>)}</div>
      </div>
      {rows.length === 0 ? <div className="empty">All caught up. New requests appear here as they arrive.</div> : (
        <ol className="inbox">
          {rows.map((r) => {
            const msgs = history.filter((m) => m.enquiryId === r.id).slice(0, 3);
            return (
              <li key={r.id} id={r.id} className={`inbox-item lvl-b-${r.work.level}`} style={{ scrollMarginTop: 80 }}>
                <div className="ib-top">
                  <span className={`lvl lvl-${r.work.level}`}>{LEVEL[r.work.level]}</span>
                  <b>{r.name}</b>
                  <span className="muted">{TYPE_LABELS[r.type] ?? r.type}{r.tripTitle ? ` · ${r.tripTitle}` : ""}{r.quotedTotal ? ` · ${fmt(r.quotedTotal)}` : ""}</span>
                  <span className="dk-chip blue" title="Who handles this">{r.assigneeId ? nameOf.get(r.assigneeId) ?? "Someone" : "Unassigned"}</span>
                  <Link className="muted" href={`/admin/clients/${clientKey(r.email)}`}>Client →</Link>
                  <Link className="mono muted ib-ref" href={`/admin/enquiries?q=${r.ref}`}>{r.ref}</Link>
                </div>
                <div className="ib-reasons">{r.work.reasons.map((x) => <span key={x}>{x}</span>)}</div>
                <p className="ib-next"><b>Next:</b> {r.work.next}{r.work.due && r.status === "new" ? <span className="muted"> · reply due {t(r.work.due)}</span> : null}</p>
                {r.summary.length > 0 && <p className="ib-sum muted">{r.summary.join(" · ")}</p>}
                {msgs.length > 0 && (
                  <ul className="ib-hist">
                    {msgs.map((m) => <li key={m.id}><span className={`ch ch-${m.channel}`}>{m.channel === "note" ? "Note" : m.channel === "email" ? "Email" : "WhatsApp"}</span> {t(m.createdAt)} · {m.subject ?? m.body.slice(0, 90)}{m.drafted ? <small className="muted"> · drafted by Riya</small> : null}</li>)}
                  </ul>
                )}
                <Copilot enquiryId={r.id} phone={r.phone} email={r.email} />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
