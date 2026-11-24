"use client";
import { useActionState, useState } from "react";
import { refundAction, type RefundState } from "@/app/admin/actions";

export interface AdminPayment { id: string; kind: string; amount: number; status: string; method: string | null; paymentId: string | null; paidAt: string | null; refunded: number }
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/** Payments on a booking, with refunds through Razorpay. */
export default function PaymentsPanel({ payments, total }: { payments: AdminPayment[]; total: number }) {
  const [state, act, busy] = useActionState<RefundState, FormData>(refundAction, undefined);
  const [open, setOpen] = useState<string | null>(null);
  const done = payments.filter((p) => p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded");
  const net = done.reduce((n, p) => n + p.amount - p.refunded, 0);
  if (!done.length) return null;
  return (
    <div className="pay-admin">
      <b>Payments · {inr(net)} of {inr(total)} received</b>
      <ul>
        {done.map((p) => (
          <li key={p.id}>
            <span>{p.kind} · {inr(p.amount)}{p.method ? ` · ${p.method}` : ""}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString("en-IN")}` : ""}{p.refunded ? ` · ${inr(p.refunded)} refunded` : ""}</span>
            <code>{p.paymentId}</code>
            {p.status !== "refunded" && <button className="link-btn" onClick={() => setOpen(open === p.id ? null : p.id)}>Refund</button>}
            {open === p.id && (
              <form action={act} className="oa-book" style={{ gridColumn: "1 / -1" }}>
                <input type="hidden" name="paymentId" value={p.id} />
                <label className="lab">Amount (₹)<input className="in" name="amount" inputMode="numeric" defaultValue={p.amount - p.refunded} style={{ width: 130 }} /></label>
                <label className="lab" style={{ flex: 1 }}>Reason<input className="in" name="reason" placeholder="e.g. Cancelled 45 days before, full refund" required /></label>
                <button className="btn danger" disabled={busy} onClick={(e) => { if (!confirm("Refund this amount to the customer through Razorpay? This can't be undone.")) e.preventDefault(); }}>{busy ? "Refunding…" : "Refund"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {state?.error && <p className="appr-err" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice ok" role="status">{state.ok}</p>}
    </div>
  );
}
