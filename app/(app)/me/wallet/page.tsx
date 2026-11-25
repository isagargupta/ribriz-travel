import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import WalletDocs from "@/components/me/WalletDocs";
import { myDashboard } from "@/lib/dashboard";
import { fmt, fmtDate } from "@/lib/pricing";
import { walletFor } from "@/lib/wallet";

export const metadata: Metadata = { title: "Wallet", robots: { index: false } };

const KIND: Record<string, string> = { deposit: "Deposit", balance: "Balance", full: "Full payment" };

/** Every ticket, voucher, reference and receipt, grouped by trip. Saved copies open offline. */
export default async function WalletPage() {
  const { me, owner } = (await myDashboard())!;
  const trips = await walletFor(owner, me.email);

  return (
    <div className="wrap wallet">
      <div className="app-page-head"><div><h1>Wallet</h1><p>Tickets, vouchers, booking references and receipts for every trip. Tap <b>Save offline</b> on anything you&apos;ll need without signal, like at the airport or abroad.</p></div></div>

      {trips.length === 0 && (
        <div className="app-empty"><b>Nothing here yet</b><p>Once you hold a trip, your receipts, booking references and documents collect here automatically.</p><Link className="btn" href="/trips">Find a trip</Link></div>
      )}

      {trips.map((t) => (
        <section key={t.missionId ?? "other"} className="panel w-trip">
          <header className="w-head">
            {t.image && <span className="w-thumb"><Image src={t.image} alt="" fill sizes="64px" /></span>}
            <div>
              <h2>{t.dest ?? t.title}</h2>
              <small className="muted">{t.date ? `${fmtDate(t.date, { day: "numeric", month: "short", year: "numeric" })}${t.returnDate ? ` – ${fmtDate(t.returnDate, { day: "numeric", month: "short" })}` : ""}` : t.missionId ? "Dates not chosen yet" : "Payments not linked to a trip"}</small>
            </div>
            {t.missionId && <Link href={`/me/trips/${t.missionId}`} className="link-btn w-open">Trip →</Link>}
          </header>

          {t.bookings.length > 0 && (
            <div className="w-block">
              <h3>Booking references</h3>
              <ul className="w-refs">
                {t.bookings.map((b) => (
                  <li key={b.id}>
                    <span className="w-ref-l"><small>{b.label}</small><b>{b.title}</b>{b.lines.slice(0, 2).map((l) => <span key={l} className="muted">{l}</span>)}</span>
                    {b.confirmation && <code className="w-code">{b.confirmation}</code>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {t.missionId && (
            <div className="w-block">
              <h3>Documents</h3>
              <WalletDocs missionId={t.missionId} trip={t.dest ?? t.title} docs={t.docs} />
            </div>
          )}

          {t.payments.length > 0 && (
            <div className="w-block">
              <h3>Payments & receipts</h3>
              <ul className="w-pays">
                {t.payments.map((p) => (
                  <li key={p.id}>
                    <span><b>{fmt(p.amount)}</b> <span className="muted">{KIND[p.kind] ?? p.kind} · {p.ref} · {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</span>
                      {p.refunded > 0 && <span className="w-refund"> · {fmt(p.refunded)} refunded</span>}</span>
                    <Link href={`/me/wallet/receipt/${p.id}`} className="btn sm">Receipt</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      <p className="muted w-note">🔒 Documents are stored privately and deleted 30 days after your trip ends. Copies saved offline stay only on this device and are removed when you sign out.</p>
    </div>
  );
}
