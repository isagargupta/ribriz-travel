import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/me/PrintButton";
import { ADDRESS_ONE_LINE, COMPANY } from "@/lib/company";
import { myDashboard } from "@/lib/dashboard";
import { fmt, fmtDate } from "@/lib/pricing";
import { receiptFor } from "@/lib/wallet";

export const metadata: Metadata = { title: "Payment receipt", robots: { index: false } };

const KIND: Record<string, string> = { deposit: "Deposit", balance: "Balance payment", full: "Full payment" };
const METHOD: Record<string, string> = { card: "Card", upi: "UPI", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

/** A printable receipt for one online payment. Only the person who booked can open it. */
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { me } = (await myDashboard())!;
  const p = await receiptFor(me.email, (await params).id);
  if (!p) notFound();
  const e = p.enquiry;
  const paid = p.paidAt ?? p.createdAt;

  return (
    <div className="wrap">
      <div className="rc-actions"><Link href="/me/wallet" className="btn sm">← Wallet</Link><PrintButton /></div>
      <article className="receipt">
        <div className="rc-top">
          <img src="/img/logo.png" alt={COMPANY.brand} />
          <div className="rc-co"><b>{COMPANY.legalName}</b><br />{ADDRESS_ONE_LINE}<br />CIN {COMPANY.cin} · {COMPANY.email}</div>
        </div>
        <h1>Payment receipt</h1>
        <p className="muted">Receipt no. {p.paymentId ?? p.orderId}</p>
        <div className="rc-grid">
          <div><small>Received from</small>{e.name}<br />{e.email}</div>
          <div><small>Date</small>{paid.toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST</div>
          <div><small>For</small>{e.tripTitle ?? "Travel booking"}{e.departure ? <><br />Departing {fmtDate(e.departure, { day: "numeric", month: "long", year: "numeric" })}</> : null}</div>
          <div><small>Booking reference</small><b>{e.ref}</b><br />{e.adults} adult{e.adults > 1 ? "s" : ""}{e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}</div>
          <div><small>Payment</small>{KIND[p.kind] ?? p.kind}{p.method ? ` · ${METHOD[p.method] ?? p.method}` : ""}</div>
          {e.quotedTotal ? <div><small>Trip total</small>{fmt(e.quotedTotal)}</div> : null}
        </div>
        <div className="rc-amt"><span>Amount received</span><b>{fmt(p.amount)}</b></div>
        {p.refundedAmount > 0 && <div className="rc-amt"><span>Refunded</span><b>− {fmt(p.refundedAmount)}</b></div>}
        <p className="rc-foot">Paid online through Razorpay{p.paymentId ? ` (payment ID ${p.paymentId})` : ""}. This is a payment receipt, not a tax invoice. GST documents (GSTIN {COMPANY.gstin}) are issued automatically and appear in your wallet: a receipt voucher for each advance, and the tax invoice once the trip is fully paid. Booking for a company? Add its GSTIN on your payment page before then.</p>
      </article>
    </div>
  );
}
