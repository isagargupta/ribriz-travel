import Link from "next/link";
import type { NoticeView } from "@/lib/notifications";

const ICON: Record<string, string> = { price_drop: "↓", hold_expiring: "⏳", hold_expired: "⌛", visa_deadline: "🛂", docs_missing: "📄", sold_out: "⚠", pre_trip: "🧳", review_request: "⭐" };

/** "Updates from Riya": what the background agent noticed, newest first. */
export default function Notices({ items, title = "Updates from Riya" }: { items: NoticeView[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="panel notices">
      <h2>{title}</h2>
      <ul>
        {items.map((n) => (
          <li key={n.id} className={`notice-item k-${n.kind}${n.unread ? " unread" : ""}`}>
            <span className="ni-ico" aria-hidden="true">{ICON[n.kind] ?? "•"}</span>
            <div>
              <b>{n.title}</b>
              <p>{n.body}</p>
              <small>{new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}{n.url && !n.url.startsWith("/hub/") && <> · <Link href={n.url}>Open</Link></>}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
