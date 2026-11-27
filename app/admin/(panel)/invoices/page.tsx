import { requireStaff } from "@/lib/staff";
import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { inr } from "@/lib/gst-rules";
import { invoicesForMonth } from "@/lib/invoices";

const thisMonth = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);

/** Every GST invoice and credit note for a month, with totals and a CSV for the accountant (GSTR-1). */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireStaff("money");
  const { month: m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth();
  const rows = await invoicesForMonth(month);
  const neg = (r: (typeof rows)[number]) => r.kind === "credit_note" || r.kind === "refund_voucher";
  const sales = rows.filter((r) => r.kind === "invoice" || r.kind === "credit_note");
  const advances = rows.filter((r) => r.kind === "receipt_voucher" || r.kind === "refund_voucher");
  const sum = (list: typeof rows, k: "taxable" | "cgst" | "sgst" | "igst" | "total") => list.reduce((n, r) => n + (neg(r) ? -1 : 1) * r[k], 0);
  const [y, mo] = month.split("-").map(Number);
  const shift = (d: number) => { const x = new Date(Date.UTC(y, mo - 1 + d, 1)); return x.toISOString().slice(0, 7); };
  const label = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="admin-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div><h1>GST documents</h1><p className="muted" style={{ margin: 0 }}>GSTIN {COMPANY.gstin} · tour packages SAC 998552 at 5%. Receipt vouchers for advances, the tax invoice when a holiday is fully paid, credit notes and refund vouchers for refunds: all automatic.</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="btn sm" href={`/admin/invoices?month=${shift(-1)}`}>‹</Link><b>{label}</b><Link className="btn sm" href={`/admin/invoices?month=${shift(1)}`}>›</Link>
          <a className="btn blue sm" href={`/admin/invoices/csv?month=${month}`}>Download CSV</a>
        </div>
      </div>
      {rows.length === 0 ? <p className="muted">No invoices or credit notes in {label}.</p> : (
        <table className="admin-table" style={{ width: "100%", fontSize: 14 }}>
          <thead><tr><th>Number</th><th>Date</th><th>Booking</th><th>Buyer</th><th>Place of supply</th><th style={{ textAlign: "right" }}>Taxable</th><th style={{ textAlign: "right" }}>CGST</th><th style={{ textAlign: "right" }}>SGST</th><th style={{ textAlign: "right" }}>IGST</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={neg(r) ? { color: "var(--warn)" } : r.kind === "receipt_voucher" ? { color: "var(--muted)" } : undefined}>
                <td><a href={`/invoice/${r.id}`} target="_blank" rel="noopener noreferrer" className="mono">{r.number}</a>{r.againstNumber ? <small className="muted"> vs {r.againstNumber}</small> : null}</td>
                <td>{r.issuedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</td>
                <td className="mono">{r.enquiry.ref}</td>
                <td>{r.buyerName}{r.buyerGstin ? <small className="muted" style={{ display: "block" }}>{r.buyerGstin}</small> : null}</td>
                <td>{r.posName}</td>
                {(["taxable", "cgst", "sgst", "igst", "total"] as const).map((k) => <td key={k} style={{ textAlign: "right" }}>{neg(r) ? "−" : ""}{inr(r[k])}</td>)}
              </tr>
            ))}
            <tr style={{ fontWeight: 800, borderTop: "2px solid var(--fg)" }}>
              <td colSpan={5}>Supplies, net ({sales.filter((r) => r.kind === "invoice").length} invoices, {sales.filter((r) => r.kind === "credit_note").length} credit notes)</td>
              {(["taxable", "cgst", "sgst", "igst", "total"] as const).map((k) => <td key={k} style={{ textAlign: "right" }}>{inr(sum(sales, k))}</td>)}
            </tr>
            {advances.length > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={5}>Advances, net ({advances.filter((r) => r.kind === "receipt_voucher").length} receipt vouchers, {advances.filter((r) => r.kind === "refund_voucher").length} refund vouchers)</td>
                {(["taxable", "cgst", "sgst", "igst", "total"] as const).map((k) => <td key={k} style={{ textAlign: "right" }}>{inr(sum(advances, k))}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
