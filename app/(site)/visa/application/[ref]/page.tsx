import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AskRiyaLink from "@/components/AskRiyaLink";
import ApplicationFlow from "@/components/visa-service/ApplicationFlow";
import { WizardFrame } from "@/components/visa-service/Wizard";
import { Icon, fmtDay } from "@/components/visa-service/ui";
import { getOwner } from "@/lib/owner";
import { fmt } from "@/lib/pricing";
import { applicationView } from "@/lib/visa-service";
import { stageIndex } from "@/lib/visa-service-rules";

export const metadata: Metadata = { title: "Your visa application", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One visa application: the rest of the wizard (documents, review & pay) until it's paid, then live tracking. */
export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; new?: string }> }) {
  const [{ ref }, { t, new: fresh }] = await Promise.all([params, searchParams]);
  const a = await applicationView(ref, t ?? null, await getOwner());
  if (!a) notFound();
  const code = a.product?.countryCode ?? "un";
  const tracking = a.paid > 0 && a.balance === 0 || ["review", "submitted", "approved", "rejected", "cancelled"].includes(a.stage);
  const docsDone = a.travellers.every((x) => x.complete);

  const summary = (
    <>
      <h3>Application {a.ref}</h3>
      <div className="vx-sum-row"><span>Visa</span><b>{a.product?.name}</b></div>
      <div className="vx-sum-row"><span>Travellers</span><b>{a.travellers.map((x) => x.name.split(" ")[0]).join(", ")}</b></div>
      {a.arrive && <div className="vx-sum-row"><span>You travel</span><b>{fmtDay(a.arrive)}</b></div>}
      {a.readyBy && <div className="vx-sum-row"><span>Expected by</span><b>{fmtDay(a.readyBy)}</b></div>}
      {a.awaitingPrice ? <div className="vx-sum-row"><span>Our fee</span><b>{fmt(a.serviceTotal)} + govt fee</b></div> : <><div className="vx-sum-row"><span>Paid</span><b>{fmt(a.paid)}</b></div><div className="vx-sum-total"><span>{a.balance ? "To pay" : "Total"}</span><b>{fmt(a.balance || a.total)}</b></div></>}
      <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--mute)" }}>We&apos;ve emailed you a link to this page. Questions? <AskRiyaLink q={`I have a question about my visa application ${a.ref}`}>Ask Riya</AskRiyaLink></p>
    </>
  );

  if (!tracking) {
    return (
      <ApplicationFlow app={a} startOn={docsDone ? "review" : "docs"} summary={summary}
        banner={fresh ? <div className="vx-note ok" style={{ marginBottom: 14 }}><Icon name="check" /><span><b>Application {a.ref} started.</b> Upload each traveller&apos;s documents, then pay. You can leave and come back any time.</span></div> : null} />
    );
  }

  const at = a.stage === "rejected" || a.stage === "cancelled" ? -1 : stageIndex(a.stage);
  return (
    <WizardFrame code={code} country={a.country} visa={a.product?.name ?? "Visa"} step={a.stage === "approved" ? 5 : 4} summary={summary}>
      <div className="vx-stage enter">
        {a.issued.length > 0 && (
          <div className="vx-done" style={{ marginBottom: 22 }}>
            <span className="vx-done-ico"><Icon name="check" /></span>
            <h2 style={{ margin: 0 }}>Your visa is ready</h2>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>Download it, print a copy and keep it on your phone. It&apos;s in your Ribriz wallet too.</p>
            {a.issued.map((x) => <div key={x.id} className="vx-dl"><span><b>{a.travellers[x.applicant]?.name ?? "Traveller"}</b><br /><small style={{ color: "var(--mute)" }}>{x.fileName}</small></span><a className="vx-btn primary" href={`/api/docs/${x.id}?raw=1&t=${a.token}`} target="_blank" rel="noopener">Download</a></div>)}
          </div>
        )}
        {at < 0 ? (
          <div className="vx-note err">{a.stage === "rejected" ? "This visa was refused. Our team has emailed you the reason and what you can do next." : "This application was cancelled."}</div>
        ) : (
          <>
            <h2>Where your visa is</h2>
            <p className="sub">{a.stage === "approved" ? "Issued. Have a wonderful trip!" : a.readyBy ? `Expected by ${fmtDay(a.readyBy, true)}. We'll update you at every step.` : "We'll update you at every step."}</p>
            <ol className="vx-track">
              {a.stages.map((s, i) => <li key={s.key} className={i < at || a.stage === "approved" ? "done" : i === at ? "now" : ""}><span>{i < at || a.stage === "approved" ? "✓" : i + 1}</span><div><b>{s.label}</b><small>{s.hint}</small></div></li>)}
            </ol>
          </>
        )}
        {a.events.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p className="vx-sublabel">Latest activity</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 10 }}>
              {a.events.map((e, i) => <li key={i} style={{ display: "grid", gap: 2, paddingLeft: 12, borderLeft: "2px solid var(--hair)" }}><small style={{ color: "var(--mute)" }}>{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} · {e.actor === "team" ? "Visa team" : e.actor === "traveller" ? "You" : "Ribriz"}</small><span>{e.text}</span></li>)}
            </ul>
          </div>
        )}
        {!a.travellers.every((x) => x.complete) && a.stage !== "approved" && <div style={{ marginTop: 18 }}><ApplicationFlow app={a} startOn="docs" embedded /></div>}
      </div>
    </WizardFrame>
  );
}
