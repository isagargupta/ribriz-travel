import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskRiyaLink from "@/components/AskRiyaLink";
import PayButton from "@/components/pay/PayButton";
import TravellerDocs from "@/components/visa-service/TravellerDocs";
import { getOwner } from "@/lib/owner";
import { fmt } from "@/lib/pricing";
import { applicationView } from "@/lib/visa-service";
import { stageIndex } from "@/lib/visa-service-rules";

export const metadata: Metadata = { title: "Your visa application", robots: { index: false } };
export const dynamic = "force-dynamic";

const fmtDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** One visa application: where it is, each traveller's documents, payment, and the issued visa. */
export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; new?: string }> }) {
  const [{ ref }, { t, new: fresh }] = await Promise.all([params, searchParams]);
  const a = await applicationView(ref, t ?? null, await getOwner());
  if (!a) notFound();
  const at = stageIndex(a.stage);
  const docsDone = a.travellers.every((x) => x.complete);

  return (
    <div className="wrap vz-app">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/visa">Visas</Link> / Application {a.ref}</nav>
      <header className="vz-app-head">
        <span className="vz-flag lg">{a.flag}</span>
        <div><h1>{a.country} visa</h1><p className="muted">{a.product?.name} · {a.travellers.length} traveller{a.travellers.length > 1 ? "s" : ""} · ref <b className="mono">{a.ref}</b></p></div>
      </header>
      {fresh && <div className="notice ok">Application started. Next: upload each traveller&apos;s documents, then pay. We&apos;ve emailed you a link to this page.</div>}

      {a.stage === "rejected" || a.stage === "cancelled" ? (
        <div className="notice err">{a.stage === "rejected" ? "This visa was refused. Our team has emailed you the reason and your options." : "This application was cancelled."}</div>
      ) : (
        <ol className="vz-track">
          {a.stages.map((s, i) => <li key={s.key} className={i < at ? "done" : i === at ? "now" : ""}><span>{i < at ? "✓" : i + 1}</span><b>{s.label}</b><small>{s.hint}</small></li>)}
        </ol>
      )}

      <div className="vz-layout">
        <div className="vz-main">
          {a.issued.length > 0 && (
            <section className="panel vz-issued">
              <h2>🎉 Your visa is ready</h2>
              <ul>{a.issued.map((x) => <li key={x.id}><span>{a.travellers[x.applicant]?.name ?? "Traveller"}</span><a className="btn hot sm" href={`/api/docs/${x.id}?raw=1&t=${a.token}`} target="_blank" rel="noopener">Download {x.fileName}</a></li>)}</ul>
              <p className="muted" style={{ marginBottom: 0, fontSize: 14 }}>Print a copy and keep it on your phone. It&apos;s also in your wallet in the app.</p>
            </section>
          )}
          <section className="panel">
            <div className="hub-sec-head"><h2>Documents</h2><span className="muted">{a.travellers.filter((x) => x.complete).length} of {a.travellers.length} traveller{a.travellers.length > 1 ? "s" : ""} complete</span></div>
            <TravellerDocs app={a} canUpload={a.canUpload} />
          </section>
        </div>
        <aside className="vz-side">
          <div className="vz-apply">
            <div className={`vz-ready ${a.deadline ?? ""}`}><span>Expected by</span><b>{a.readyBy ? fmtDay(a.readyBy) : "–"}</b>{a.arrive && <small>You travel {fmtDay(a.arrive)}</small>}</div>
            <table className="vz-price"><tbody>
              <tr><td>Total</td><td>{fmt(a.total)}</td></tr>
              <tr><td>Paid</td><td>{fmt(a.paid)}</td></tr>
              <tr className="tot"><td>To pay</td><td>{fmt(a.balance)}</td></tr>
            </tbody></table>
            {a.payPath ? (
              <>
                {!docsDone && <p className="fine">You can pay now and finish uploads after; we file once everything is in.</p>}
                <PayButton refCode={a.ref} token={a.token} label={`Pay ${fmt(a.balance)} securely`} />
              </>
            ) : a.paid > 0 ? <p className="ok-txt" style={{ margin: 0 }}>✓ Paid. Our visa team takes it from here.</p> : null}
            <p className="fine center">Questions? <AskRiyaLink q={`I have a question about my visa application ${a.ref}`}>Ask Riya</AskRiyaLink></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
