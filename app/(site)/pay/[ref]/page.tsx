import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PayButton from "@/components/pay/PayButton";
import Consent from "@/components/legal/Consent";
import { getOwner } from "@/lib/owner";
import { payView } from "@/lib/payments";
import { addDays, fmt, fmtDate } from "@/lib/pricing";

export const metadata: Metadata = { title: "Pay for your trip", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { deposit: "Deposit", balance: "Balance", full: "Full payment" };
const BLOCKED: Record<string, string> = {
  hold_expired: "This price hold has ended, so the price may have changed. Ask Riya to hold today's price again, then pay here.",
  closed: "This booking is closed.", departed: "This trip has already started.", no_total: "We'll send your final price before you pay.",
};

export default async function PayPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ ref }, { t }] = await Promise.all([params, searchParams]);
  const v = await payView(ref.toUpperCase(), t ?? null, await getOwner());
  if (!v) notFound();
  const { plan } = v;
  const pct = v.total ? Math.min(100, Math.round((plan.paid / v.total) * 100)) : 0;
  const long = { day: "numeric", month: "short", year: "numeric" } as const;

  return (
    <div className="wrap pay-page">
      <div className="pay-card">
        <div className="pay-trip">
          {v.image && <span className="pay-img"><Image src={v.image} alt="" fill sizes="200px" /></span>}
          <div>
            <small className="muted mono">{v.ref}</small>
            <h1>{v.tripTitle ?? "Your trip"}</h1>
            <p className="muted">{v.departure ? `${fmtDate(v.departure)}${v.nights ? ` – ${fmtDate(addDays(v.departure, v.nights), long)}` : ""}` : ""} · {v.adults} adult{v.adults > 1 ? "s" : ""}{v.children ? `, ${v.children} child${v.children > 1 ? "ren" : ""}` : ""}</p>
          </div>
        </div>

        <div className="pay-progress" aria-label={`${pct}% paid`}><i style={{ width: `${pct}%` }} /></div>
        <dl className="pay-sum">
          <div><dt>Trip total incl. GST</dt><dd>{fmt(v.total)}</dd></div>
          <div><dt>Paid</dt><dd>{fmt(plan.paid)}</dd></div>
          <div><dt>Balance</dt><dd>{fmt(plan.balance)}{plan.balance > 0 && plan.balanceDue ? <small> due by {fmtDate(plan.balanceDue, long)}</small> : null}</dd></div>
        </dl>

        {plan.next ? (
          !v.enabled ? <p className="notice warn">Online payment isn&apos;t switched on yet. Reply to your confirmation email and we&apos;ll help you pay.</p> : (
            <>
              <div className="pay-due">
                <span>{plan.next.kind === "deposit" ? "Pay the deposit to book" : plan.next.kind === "full" ? "Pay in full to book (you leave within 30 days)" : "Pay the balance"}</span>
                <b>{fmt(plan.next.amount)}</b>
              </div>
              <PayButton refCode={v.ref} token={t ?? null} label={`Pay ${fmt(plan.next.amount)} securely`} />
              <Consent action="paying" extra="See also our cancellation & refunds policy." />
            </>
          )
        ) : plan.balance === 0 ? (
          <div className="pay-done"><span className="pay-tick">✓</span><b>Paid in full</b><p>Thank you! Your trip is fully paid.</p></div>
        ) : (
          <p className="notice warn">{BLOCKED[plan.blocked ?? ""] ?? "Nothing is due right now."}</p>
        )}

        {v.payments.length > 0 && (
          <section className="pay-hist">
            <h2>Payments</h2>
            <ul>
              {v.payments.map((p, i) => (
                <li key={i} className={`ph-${p.status}`}>
                  <span>{KIND[p.kind] ?? p.kind}{p.method ? ` · ${p.method.toUpperCase()}` : ""}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
                  <b>{fmt(p.amount)}</b>
                  <small>{p.status === "paid" ? "Paid" : p.status === "failed" ? "Failed, not charged" : p.status === "refunded" ? "Refunded" : p.status === "partially_refunded" ? `${fmt(p.refunded)} refunded` : p.status}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="fine center" style={{ marginTop: 16 }}>{v.missionId ? <Link href={`/me/trips/${v.missionId}`}>Open your trip</Link> : <Link href={`/booking?ref=${v.ref}`}>View booking</Link>} · <Link href="/legal/cancellation">Cancellations &amp; refunds</Link></p>
      </div>
    </div>
  );
}
