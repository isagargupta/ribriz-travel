import Link from "next/link";
import { saveVisaProduct } from "../../actions";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { countryName } from "@/lib/visa";
import { STAGES, VISA_KIND_LABEL, visaPrice, type VisaKind } from "@/lib/visa-service-rules";

const docsText = (json: string) => (JSON.parse(json) as { kind: string; label: string; note?: string }[]).map((d) => [d.kind, d.label, d.note].filter(Boolean).join(" | ")).join("\n");

function ProductForm({ p }: { p?: Awaited<ReturnType<typeof prisma.visaProduct.findMany>>[number] }) {
  return (
    <form action={saveVisaProduct} className="vadm-form">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="vadm-grid">
        <label>Country code<input className="in" name="countryCode" defaultValue={p?.countryCode} placeholder="JP" maxLength={2} required /></label>
        <label>Page address<input className="in" name="destSlug" defaultValue={p?.destSlug} placeholder="japan" /></label>
        <label className="wide">Visa name<input className="in" name="name" defaultValue={p?.name} placeholder="Tourist e-Visa (single entry)" required /></label>
        <label>Type<select className="in" name="kind" defaultValue={p?.kind ?? "evisa"}>{Object.entries(VISA_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Entries<select className="in" name="entries" defaultValue={p?.entries ?? "single"}><option value="single">Single</option><option value="double">Double</option><option value="multiple">Multiple</option></select></label>
        <label>Stay (days)<input className="in" name="stayDays" type="number" defaultValue={p?.stayDays ?? ""} /></label>
        <label>Valid (days)<input className="in" name="validityDays" type="number" defaultValue={p?.validityDays ?? ""} /></label>
        <label>Processing (working days)<input className="in" name="processingDays" type="number" defaultValue={p?.processingDays ?? 5} required /></label>
        <label>Government fee ₹<input className="in" name="govtFee" type="number" defaultValue={p?.govtFee ?? 0} required /></label>
        <label>Service fee ₹<input className="in" name="serviceFee" type="number" defaultValue={p?.serviceFee ?? 999} required /></label>
        <label>Order<input className="in" name="order" type="number" defaultValue={p?.order ?? 100} /></label>
        <label className="wide">Documents, one per line: <code>kind | label | note</code> (kinds: passport, photo, bank_statement, itr, employment_proof, cover_letter, insurance, flight_booking, hotel_booking, other)
          <textarea className="in" name="docs" rows={4} defaultValue={p ? docsText(p.docs) : "passport | Passport: front and back pages\nphoto | Passport-size photo | White background"} /></label>
        <label className="wide">Notes shown on the page (one per line)<textarea className="in" name="notes" rows={2} defaultValue={p?.notes ?? ""} /></label>
      </div>
      <div className="vadm-checks">
        <label className="chk"><input type="checkbox" name="published" defaultChecked={p ? p.published : true} /> Published</label>
        <label className="chk"><input type="checkbox" name="popular" defaultChecked={p?.popular} /> Popular</label>
        <label className="chk"><input type="checkbox" name="needsAppointment" defaultChecked={p?.needsAppointment} /> Needs visa-centre appointment</label>
        <label className="chk"><input type="checkbox" name="verified" defaultChecked={!!p?.verifiedAt} /> Fee and rules checked against the official source</label>
        <button className="btn blue sm">{p ? "Save" : "Add visa"}</button>
      </div>
    </form>
  );
}

/** The visa catalogue (what's sold, at what price) and the applications in progress. */
export default async function VisasAdmin() {
  const [products, apps] = await Promise.all([
    prisma.visaProduct.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
    prisma.enquiry.findMany({ where: { type: "visa", details: { contains: "\"stage\"" } }, orderBy: { createdAt: "desc" }, take: 40, include: { payments: { where: { status: { in: ["paid", "partially_refunded"] } } } } }),
  ]);
  const unverified = products.filter((p) => p.published && !p.verifiedAt).length;
  return (
    <div>
      <div className="admin-head"><h1>Visas</h1><p className="muted" style={{ margin: 0 }}>What customers can apply for at <Link href="/visa" target="_blank">/visa</Link>. Price per traveller = government fee + service fee + 18% GST on the service fee.</p></div>
      {unverified > 0 && <div className="notice warn" style={{ marginBottom: 14 }}><b>{unverified} published visa{unverified > 1 ? "s show" : " shows"} &ldquo;Fee being confirmed&rdquo;.</b> The starting fees are estimates: check each against the official government or embassy source, correct it, and tick &ldquo;checked&rdquo;.</div>}

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Applications</h2>
        {apps.length === 0 ? <p className="muted">No applications yet.</p> : (
          <table className="admin-table" style={{ width: "100%", fontSize: 14 }}>
            <thead><tr><th>Ref</th><th>Visa</th><th>Travellers</th><th>Travel</th><th>Stage</th><th>Paid</th><th /></tr></thead>
            <tbody>{apps.map((e) => {
              const d = JSON.parse(e.details ?? "{}");
              const st = STAGES.find((s) => s.key === d.stage)?.label ?? d.stage;
              return <tr key={e.id}><td className="mono">{e.ref}</td><td>{e.tripTitle}</td><td>{e.adults}</td><td>{e.departure}</td><td>{st}</td><td>{e.payments.length ? fmt(e.payments.reduce((n, p) => n + p.amount - p.refundedAmount, 0)) : "–"}</td><td><Link href={`/admin/enquiries?q=${e.ref}`}>Open</Link></td></tr>;
            })}</tbody>
          </table>
        )}
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Catalogue ({products.length})</h2>
        <div className="vadm-list">
          {products.map((p) => (
            <details key={p.id} className="vadm-item">
              <summary>
                <b>{countryName(p.countryCode)}</b> · {p.name} <span className="muted">· {VISA_KIND_LABEL[p.kind as VisaKind] ?? p.kind} · {p.processingDays}d · {fmt(visaPrice(p).perPerson)}</span>
                {!p.published && <span className="vz-kind">Hidden</span>}{p.published && !p.verifiedAt && <span className="vz-unverified">Not checked</span>}{p.verifiedAt && <span className="ok-txt" style={{ fontSize: 12 }}> ✓ checked {p.verifiedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
              </summary>
              <ProductForm p={p} />
            </details>
          ))}
        </div>
      </section>

      <section className="panel"><h2 style={{ marginTop: 0 }}>Add a visa</h2><ProductForm /></section>
    </div>
  );
}
