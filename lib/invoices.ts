import "server-only";
import type { Invoice, Prisma } from "@prisma/client";
import { COMPANY } from "./company";
import { prisma } from "./db";
import { checkGstin, docNumber, financialYear, placeOfSupply, splitTax, type DocKind } from "./gst-rules";
import { fmtDate } from "./pricing";
import { sign } from "./signing";

/**
 * GST tax invoices and credit notes for holiday packages.
 * - Tour operator services, SAC 998552, 5% (the GST already in our package prices).
 * - Issued automatically once a holiday is fully paid; the team can also issue one from the admin.
 * - Numbers are consecutive per financial year (RB/2026-27/0001) with no gaps: the
 *   number is taken inside the same database transaction that saves the invoice.
 * - Invoices are never edited or deleted. Refunds after invoicing get a credit note.
 */
export const HOLIDAY_SAC = "998552";
export const HOLIDAY_GST_RATE = 5;
/** Request types invoiced as tour packages. Flights, hotels and other services follow different GST rules and are invoiced by hand. */
export const INVOICED_TYPES = ["hold", "custom"];

export class InvoiceError extends Error {}

type Tx = Prisma.TransactionClient;

/** Browser tests (E2E=1) number their documents in a separate TS/ series so real numbering never has gaps. */
const testSeries = () => process.env.E2E === "1";

const TEST_PREFIX: Record<DocKind, string> = { invoice: "TS", credit_note: "TC", receipt_voucher: "TV", refund_voucher: "TF" };
const numberFor = (kind: DocKind, fy: string, seq: number) => (testSeries() ? docNumber(kind, fy, seq).replace(/^[A-Z]{2}/, TEST_PREFIX[kind]) : docNumber(kind, fy, seq));

async function takeNumber(tx: Tx, kind: DocKind, fy: string) {
  const key = `${testSeries() ? "test:" : ""}${kind}:${fy}`;
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocCounter" ("key", "next") VALUES (${key}, 2)
    ON CONFLICT ("key") DO UPDATE SET "next" = "DocCounter"."next" + 1
    RETURNING "next" - 1 AS seq`;
  return Number(rows[0].seq);
}

const paidPaise = (payments: { status: string; amount: number; refundedAmount: number }[]) =>
  payments.reduce((n, p) => n + (p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded" ? (p.amount - p.refundedAmount) * 100 : 0), 0);

/** The tax invoice for a booking, issued once. Returns the existing one if it's already been issued. */
export async function issueInvoice(enquiryId: string, opts: { requireFullyPaid?: boolean } = {}): Promise<Invoice> {
  const existing = await prisma.invoice.findFirst({ where: { enquiryId, kind: "invoice" } });
  if (existing) return existing;
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId }, include: { payments: true, trip: { select: { title: true, nights: true } } } });
  if (!e) throw new InvoiceError("Booking not found.");
  if (!INVOICED_TYPES.includes(e.type)) throw new InvoiceError("Only holiday packages are invoiced automatically. Flights, hotels and other services need an invoice made by hand.");
  const amount = paidPaise(e.payments);
  if (amount <= 0) throw new InvoiceError("Nothing has been paid on this booking yet.");
  if (opts.requireFullyPaid && amount < (e.quotedTotal ?? 0) * 100) throw new InvoiceError("Not fully paid yet.");

  const gstin = e.billingGstin && checkGstin(e.billingGstin).ok ? e.billingGstin : null;
  const pos = placeOfSupply(COMPANY.gstState, gstin);
  const tax = splitTax(amount, HOLIDAY_GST_RATE, pos.code === COMPANY.gstState);
  const party = `${e.adults} adult${e.adults > 1 ? "s" : ""}${e.children ? `, ${e.children} child${e.children > 1 ? "ren" : ""}` : ""}`;
  const title = e.trip?.title ?? e.tripTitle ?? "Holiday package";
  const description = `Tour package: ${title}${e.departure ? `, ${e.trip ? `${e.trip.nights} nights from ` : "departing "}${fmtDate(e.departure, { day: "numeric", month: "short", year: "numeric" })}` : ""}, ${party}. Booking ${e.ref}.`;
  const now = new Date();
  const fy = financialYear(now);

  return prisma.$transaction(async (tx) => {
    // a second payment confirmation racing this one: whoever is first issues it
    const again = await tx.invoice.findFirst({ where: { enquiryId, kind: "invoice" } });
    if (again) return again;
    const seq = await takeNumber(tx, "invoice", fy);
    return tx.invoice.create({
      data: {
        kind: "invoice", number: numberFor("invoice", fy, seq), fy, seq, enquiryId, issuedAt: now,
        buyerName: (e.billingName || e.name).slice(0, 120), buyerEmail: e.email, buyerGstin: gstin, buyerAddress: e.billingAddress?.slice(0, 300) ?? null,
        posCode: pos.code, posName: pos.name, sac: HOLIDAY_SAC, description: description.slice(0, 400), rate: HOLIDAY_GST_RATE,
        taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
      },
    });
  });
}

/** A credit note reducing an invoice, e.g. after a refund. Never more than what's left on the invoice. */
export async function issueCreditNote(invoiceId: string, rupees: number, reason: string): Promise<Invoice> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.kind !== "invoice") throw new InvoiceError("Invoice not found.");
  const now = new Date();
  const fy = financialYear(now);
  return prisma.$transaction(async (tx) => {
    const prior = await tx.invoice.aggregate({ where: { againstId: inv.id, kind: "credit_note" }, _sum: { total: true } });
    const left = inv.total - (prior._sum.total ?? 0);
    const amount = Math.min(Math.round(rupees * 100), left);
    if (amount <= 0) throw new InvoiceError("This invoice has already been fully credited.");
    const tax = splitTax(amount, inv.rate, inv.cgst + inv.sgst > 0);
    const seq = await takeNumber(tx, "credit_note", fy);
    return tx.invoice.create({
      data: {
        kind: "credit_note", number: numberFor("credit_note", fy, seq), fy, seq, enquiryId: inv.enquiryId, againstId: inv.id, issuedAt: now,
        buyerName: inv.buyerName, buyerEmail: inv.buyerEmail, buyerGstin: inv.buyerGstin, buyerAddress: inv.buyerAddress,
        posCode: inv.posCode, posName: inv.posName, sac: inv.sac, description: `Credit against invoice ${inv.number}: ${reason}`.slice(0, 400), rate: inv.rate,
        taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total, reason: reason.slice(0, 200),
      },
    });
  });
}

/**
 * GST on advances: a receipt voucher for each payment taken before the tour is
 * invoiced (deposit, part payments). Once per payment. The final invoice covers
 * the full value and lists the vouchers it adjusts.
 */
export async function issueReceiptVoucher(paymentRowId: string): Promise<Invoice | null> {
  const pay = await prisma.payment.findUnique({ where: { id: paymentRowId }, include: { enquiry: { include: { trip: { select: { title: true } } } } } });
  if (!pay || pay.status !== "paid" || !INVOICED_TYPES.includes(pay.enquiry.type)) return null;
  const existing = await prisma.invoice.findFirst({ where: { paymentRowId, kind: "receipt_voucher" } });
  if (existing) return existing;
  if (await prisma.invoice.count({ where: { enquiryId: pay.enquiryId, kind: "invoice" } })) return null; // already invoiced
  const e = pay.enquiry;
  const gstin = e.billingGstin && checkGstin(e.billingGstin).ok ? e.billingGstin : null;
  const pos = placeOfSupply(COMPANY.gstState, gstin);
  const tax = splitTax(pay.amount * 100, HOLIDAY_GST_RATE, pos.code === COMPANY.gstState);
  const now = new Date(), fy = financialYear(now);
  return prisma.$transaction(async (tx) => {
    const seq = await takeNumber(tx, "receipt_voucher", fy);
    return tx.invoice.create({
      data: {
        kind: "receipt_voucher", number: numberFor("receipt_voucher", fy, seq), fy, seq, enquiryId: e.id, paymentRowId, issuedAt: now,
        buyerName: (e.billingName || e.name).slice(0, 120), buyerEmail: e.email, buyerGstin: gstin, buyerAddress: e.billingAddress?.slice(0, 300) ?? null,
        posCode: pos.code, posName: pos.name, sac: HOLIDAY_SAC, rate: HOLIDAY_GST_RATE,
        description: `Advance (${pay.kind}) received for tour package: ${e.trip?.title ?? e.tripTitle ?? "holiday"}. Booking ${e.ref}.`.slice(0, 400),
        taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
      },
    });
  });
}

/** An advance refunded before the tour was invoiced gets a refund voucher against its receipt voucher. */
export async function issueRefundVoucher(paymentRowId: string, rupees: number, reason: string): Promise<Invoice | null> {
  const rv = await prisma.invoice.findFirst({ where: { paymentRowId, kind: "receipt_voucher" } });
  if (!rv) return null;
  const now = new Date(), fy = financialYear(now);
  return prisma.$transaction(async (tx) => {
    const prior = await tx.invoice.aggregate({ where: { againstId: rv.id, kind: "refund_voucher" }, _sum: { total: true } });
    const amount = Math.min(Math.round(rupees * 100), rv.total - (prior._sum.total ?? 0));
    if (amount <= 0) return null;
    const tax = splitTax(amount, rv.rate, rv.cgst + rv.sgst > 0);
    const seq = await takeNumber(tx, "refund_voucher", fy);
    return tx.invoice.create({
      data: {
        kind: "refund_voucher", number: numberFor("refund_voucher", fy, seq), fy, seq, enquiryId: rv.enquiryId, againstId: rv.id, paymentRowId, issuedAt: now,
        buyerName: rv.buyerName, buyerEmail: rv.buyerEmail, buyerGstin: rv.buyerGstin, buyerAddress: rv.buyerAddress, posCode: rv.posCode, posName: rv.posName,
        sac: rv.sac, rate: rv.rate, description: `Refund of advance received under ${rv.number}: ${reason}`.slice(0, 400), reason: reason.slice(0, 200),
        taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
      },
    });
  });
}

/** After a payment on a holiday: the tax invoice if it's now fully paid, else a receipt voucher for the advance. Never throws. */
export async function gstDocsAfterPayment(enquiryId: string, paymentRowId: string | null, fullyPaid: boolean) {
  try {
    if (fullyPaid) return await invoiceIfFullyPaid(enquiryId);
    if (!paymentRowId) return null;
    const rv = await issueReceiptVoucher(paymentRowId);
    if (rv && !rv.emailedAt) await emailInvoice(rv);
    return rv;
  } catch (e) { console.error("GST document failed", e); return null; }
}

/** Link token so a guest can open their invoice from the email without signing in. */
export const invoiceToken = (id: string) => sign(`inv:${id}`).slice(0, 24);
export const invoiceUrl = (id: string) => `/invoice/${id}?t=${invoiceToken(id)}`;

/** Issues and emails the invoice once a holiday is fully paid. Never throws: payments must not fail because of it. */
export async function invoiceIfFullyPaid(enquiryId: string) {
  try {
    const inv = await issueInvoice(enquiryId, { requireFullyPaid: true });
    if (!inv.emailedAt) await emailInvoice(inv);
    return inv;
  } catch (e) {
    if (!(e instanceof InvoiceError)) console.error("invoice failed", e);
    return null;
  }
}

export async function emailInvoice(inv: Invoice) {
  const { sendEmail } = await import("./email");
  const { invoiceEmail } = await import("./email-templates");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
  const e = await prisma.enquiry.findUnique({ where: { id: inv.enquiryId }, select: { name: true, ref: true } });
  const r = await sendEmail({ to: inv.buyerEmail, idempotencyKey: `invoice-${inv.id}`, ...invoiceEmail({ name: e?.name ?? inv.buyerName, number: inv.number, kind: inv.kind, total: inv.total, ref: e?.ref ?? "", url: site + invoiceUrl(inv.id) }) });
  if (r.ok) await prisma.invoice.update({ where: { id: inv.id }, data: { emailedAt: new Date() } });
}

/** One row per document for the accountant (GSTR-1): the month's invoices and credit notes. */
export async function invoicesForMonth(month: string) {
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const rows = await prisma.invoice.findMany({ where: { issuedAt: { gte: start, lt: end } }, orderBy: [{ kind: "asc" }, { seq: "asc" }], include: { enquiry: { select: { ref: true } } } });
  const ids = rows.map((r) => r.againstId).filter((x): x is string => !!x);
  const against = new Map((await prisma.invoice.findMany({ where: { id: { in: ids } }, select: { id: true, number: true } })).map((x) => [x.id, x.number]));
  return rows.map((r) => ({ ...r, againstNumber: r.againstId ? against.get(r.againstId) ?? null : null }));
}

export function toCsv(rows: Awaited<ReturnType<typeof invoicesForMonth>>) {
  const q = (v: string | number | null) => { const s = v === null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rs = (p: number, neg: boolean) => ((neg ? -p : p) / 100).toFixed(2);
  const head = ["Type", "Number", "Date", "Booking", "Buyer", "Buyer GSTIN", "Place of supply", "SAC", "Rate %", "Taxable value", "CGST", "SGST", "IGST", "Total", "Against invoice", "Reason"];
  const lines = rows.map((r) => {
    const cn = r.kind === "credit_note" || r.kind === "refund_voucher";
    return [({ invoice: "Invoice", credit_note: "Credit note", receipt_voucher: "Receipt voucher (advance)", refund_voucher: "Refund voucher" } as Record<string, string>)[r.kind] ?? r.kind, r.number, r.issuedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), r.enquiry.ref, r.buyerName, r.buyerGstin, `${r.posCode}-${r.posName}`, r.sac, r.rate,
      rs(r.taxable, cn), rs(r.cgst, cn), rs(r.sgst, cn), rs(r.igst, cn), rs(r.total, cn), r.againstNumber ?? "", r.reason].map(q).join(",");
  });
  return [head.join(","), ...lines].join("\n") + "\n";
}
