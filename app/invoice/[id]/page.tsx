import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/me/PrintButton";
import { isAdmin } from "@/lib/auth";
import { ADDRESS_ONE_LINE, COMPANY } from "@/lib/company";
import { currentCustomer } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { DOC_TITLE, amountInWords, inr, type DocKind } from "@/lib/gst-rules";
import { invoiceToken } from "@/lib/invoices";
import { safeEqual } from "@/lib/signing";
import "./invoice.css";

export const metadata: Metadata = { title: "GST document", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * A GST tax invoice or credit note, ready to print or save as PDF. Opens with
 * the link from the email, for the signed-in traveller who booked, or for the team.
 */
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { enquiry: { select: { ref: true } } } });
  if (!inv) notFound();
  const me = await currentCustomer();
  const allowed = (t && safeEqual(t, invoiceToken(inv.id))) || (me && me.email.toLowerCase() === inv.buyerEmail.toLowerCase()) || (await isAdmin());
  if (!allowed) notFound();
  const against = inv.againstId ? await prisma.invoice.findUnique({ where: { id: inv.againstId }, select: { number: true, issuedAt: true } }) : null;
  const cn = inv.kind === "credit_note" || inv.kind === "refund_voucher";
  const rv = inv.kind === "receipt_voucher";
  const title = DOC_TITLE[inv.kind as DocKind] ?? "Tax invoice";
  // the invoice lists the advances (receipt vouchers) it adjusts
  const advances = inv.kind === "invoice" ? await prisma.invoice.findMany({ where: { enquiryId: inv.enquiryId, kind: { in: ["receipt_voucher", "refund_voucher"] }, issuedAt: { lte: inv.issuedAt } }, orderBy: { issuedAt: "asc" } }) : [];
  const intra = inv.cgst + inv.sgst > 0;
  const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  return (
    <main className="inv-wrap">
      <div className="inv-actions"><PrintButton /></div>
      <article className="inv">
        <header className="inv-top">
          <div>
            <img src="/img/logo.png" alt={COMPANY.brand} className="inv-logo" />
            <p><b>{COMPANY.legalName}</b><br />{ADDRESS_ONE_LINE}<br />GSTIN <b>{COMPANY.gstin}</b> · State: Karnataka (29)<br />CIN {COMPANY.cin} · {COMPANY.email}</p>
          </div>
          <div className="inv-title">
            <h1>{title}</h1>
            <dl>
              <dt>{title} no.</dt><dd className="mono">{inv.number}</dd>
              <dt>Date</dt><dd>{date(inv.issuedAt)}</dd>
              {against && <><dt>{inv.kind === "refund_voucher" ? "Against receipt voucher" : "Against invoice"}</dt><dd className="mono">{against.number} ({date(against.issuedAt)})</dd></>}
              <dt>Booking ref.</dt><dd className="mono">{inv.enquiry.ref}</dd>
            </dl>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <small>Bill to</small>
            <p><b>{inv.buyerName}</b>{inv.buyerAddress ? <><br />{inv.buyerAddress}</> : null}<br />{inv.buyerEmail}{inv.buyerGstin ? <><br />GSTIN <b>{inv.buyerGstin}</b></> : <><br />Unregistered (consumer)</>}</p>
          </div>
          <div>
            <small>Place of supply</small>
            <p><b>{inv.posName} ({inv.posCode})</b><br />Reverse charge: No</p>
          </div>
        </section>

        <table className="inv-lines">
          <thead><tr><th>#</th><th>Description</th><th>SAC</th><th className="r">Taxable value</th></tr></thead>
          <tbody><tr><td>1</td><td>{inv.description}</td><td className="mono">{inv.sac}</td><td className="r">{inr(inv.taxable)}</td></tr></tbody>
        </table>

        <table className="inv-tax">
          <tbody>
            <tr><td>{rv ? "Value of advance (excl. GST)" : "Taxable value"}</td><td className="r">{inr(inv.taxable)}</td></tr>
            {intra ? (
              <>
                <tr><td>CGST @ {inv.rate / 2}%</td><td className="r">{inr(inv.cgst)}</td></tr>
                <tr><td>SGST @ {inv.rate / 2}%</td><td className="r">{inr(inv.sgst)}</td></tr>
              </>
            ) : <tr><td>IGST @ {inv.rate}%</td><td className="r">{inr(inv.igst)}</td></tr>}
            <tr className="inv-total"><td>{cn ? (inv.kind === "refund_voucher" ? "Total refunded" : "Total credited") : rv ? "Advance received" : "Invoice total"}</td><td className="r">{inr(inv.total)}</td></tr>
          </tbody>
        </table>
        <p className="inv-words">{amountInWords(inv.total)}</p>
        {cn && inv.reason && <p className="inv-note">Reason: {inv.reason}</p>}
        {advances.length > 0 && (
          <p className="inv-note">Advances already received and taxed, adjusted against this invoice: {advances.map((a) => `${a.number} (${a.kind === "refund_voucher" ? "−" : ""}${inr(a.total)})`).join(", ")}. GST shown above is the total for the supply; tax already paid on the advances is adjusted in our returns.</p>
        )}

        <footer className="inv-foot">
          <p>Tour operator services (SAC {inv.sac}) taxed at {inv.rate}% on the gross amount charged, without input tax credit. {rv ? "Receipt voucher for an advance received before the tour is supplied; the tax invoice follows once the trip is fully paid." : inv.kind === "refund_voucher" ? "Refund of an advance for which no tax invoice had been issued." : cn ? "This credit note reduces the tax charged on the invoice above." : "Amounts paid online through Razorpay; see your payment receipts for transaction details."}</p>
          <div className="inv-sign"><span>For {COMPANY.legalName}</span><b>Authorised signatory</b><small>Computer-generated document; no signature required.</small></div>
        </footer>
      </article>
    </main>
  );
}
