import Link from "next/link";
import Copilot from "@/components/admin/Copilot";
import { prisma } from "@/lib/db";
import { TYPE_LABELS, inbox } from "@/lib/inbox";
import { fmt } from "@/lib/pricing";

const LEVEL: Record<string, string> = { urgent: "Urgent", today: "Today", soon: "Soon", fyi: "Waiting" };
const t = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Inbox() {
  const rows = await inbox();
  const history = await prisma.teamMessage.findMany({ where: { enquiryId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: "desc" } });
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.work.level] = (m[r.work.level] ?? 0) + 1), m), {});

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Every open request, most urgent first. Riya drafts each reply; you check it and send.</p>
        </div>
        <div className="inbox-counts">{(["urgent", "today", "soon", "fyi"] as const).map((l) => <span key={l} className={`lvl lvl-${l}`}>{counts[l] ?? 0} {LEVEL[l].toLowerCase()}</span>)}</div>
      </div>
      {rows.length === 0 ? <div className="empty">All caught up. New requests appear here as they arrive.</div> : (
        <ol className="inbox">
          {rows.map((r) => {
            const msgs = history.filter((m) => m.enquiryId === r.id).slice(0, 3);
            return (
              <li key={r.id} className={`inbox-item lvl-b-${r.work.level}`}>
                <div className="ib-top">
                  <span className={`lvl lvl-${r.work.level}`}>{LEVEL[r.work.level]}</span>
                  <b>{r.name}</b>
                  <span className="muted">{TYPE_LABELS[r.type] ?? r.type}{r.tripTitle ? ` · ${r.tripTitle}` : ""}{r.quotedTotal ? ` · ${fmt(r.quotedTotal)}` : ""}</span>
                  <Link className="mono muted ib-ref" href={`/admin/enquiries#${r.id}`}>{r.ref}</Link>
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
