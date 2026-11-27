"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PayButton from "../pay/PayButton";
import { usePrefs } from "../Prefs";
import type { ApplicationView } from "@/lib/visa-service";
import { Icon } from "./ui";
import { WizardFrame } from "./Wizard";

type Doc = ApplicationView["travellers"][number]["docs"][number];
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** One document slot: drop a file, choose one or use the camera; preview, AI scan, result. */
function Dropzone({ d, traveller, missionId, token, canUpload, onDone }: { d: Doc; traveller: number; missionId: string; token: string; canUpload: boolean; onDone: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(matchMedia("(pointer: coarse)").matches); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const last = d.uploaded[0];
  const state = busy ? "busy" : !last ? "todo" : last.status === "ok" ? "ok" : last.status === "checking" ? "busy" : "issue";

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) { setErr("Use a photo (JPG, PNG) or a PDF."); return; }
    setErr(null); setBusy(true);
    if (file.type.startsWith("image/")) setPreview(URL.createObjectURL(file));
    const body = new FormData(); body.append("file", file); body.append("kind", d.kind); body.append("applicant", String(traveller));
    try {
      const r = await fetch(`/api/missions/${missionId}/docs`, { method: "POST", body });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Upload failed. Please try again.");
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const thumb = preview ?? (last?.image ? `/api/docs/${last.id}?raw=1&t=${token}` : null);
  return (
    <div
      className={`vx-drop ${drag ? "drag" : ""} ${state === "ok" ? "ok" : state === "issue" ? "issue" : ""}`}
      onDragOver={(e) => { if (!canUpload) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && canUpload) upload(f); }}
    >
      <span className={`vx-thumb ${state === "busy" ? "vx-scan" : ""}`}>
        {thumb ? <img src={thumb} alt="" /> : <Icon name={d.kind === "photo" ? "user" : d.kind === "passport" ? "passport" : "doc"} />}
        {state === "ok" && <span className="vx-tick"><Icon name="check" /></span>}
      </span>
      <span className="vx-drop-txt">
        <b>{d.label}</b>
        <small role={state === "issue" || err ? "alert" : undefined}>
          {err ?? (state === "busy" ? "Checking with AI…" : state === "ok" ? `Looks good · ${last!.fileName}` : state === "issue" ? last!.findings[0] ?? "Needs a second look: try a clearer photo." : d.note ?? (canUpload ? "Drop a file here, or choose one" : "Not uploaded yet"))}
        </small>
      </span>
      {canUpload && (
        <span className="vx-drop-acts">
          <label className={`vx-up ${state === "ok" ? "alt" : ""}`}><Icon name="upload" />{state === "todo" ? "Upload" : "Replace"}<input type="file" accept={ACCEPT} disabled={busy} aria-label={`Upload ${d.label}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>
          {touch && <label className="vx-up alt"><Icon name="camera" />Camera<input type="file" accept="image/*" capture="environment" disabled={busy} aria-label={`Take a photo of ${d.label}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>}
        </span>
      )}
    </div>
  );
}

/** Steps 3–4 of the wizard: each traveller's documents, then review and pay. */
export default function ApplicationFlow({ app, startOn, summary, banner, embedded = false }: { app: ApplicationView; startOn: "docs" | "review"; summary?: React.ReactNode; banner?: React.ReactNode; embedded?: boolean }) {
  const [view, setView] = useState(startOn);
  const body = <FlowBody app={app} view={view} setView={setView} />;
  if (embedded) return body;
  return <WizardFrame code={app.product?.countryCode ?? "un"} country={app.country} visa={app.product?.name ?? "Visa"} step={view === "docs" ? 2 : 3} summary={summary}>{banner}{body}</WizardFrame>;
}

function FlowBody({ app, view, setView }: { app: ApplicationView; view: "docs" | "review"; setView: (v: "docs" | "review") => void }) {
  const router = useRouter();
  const { money } = usePrefs();
  const firstOpen = Math.max(0, app.travellers.findIndex((t) => !t.complete));
  const [open, setOpen] = useState<number>(firstOpen);
  const done = app.travellers.filter((t) => t.complete).length;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [view]);

  if (view === "docs") return (
    <div className="vx-stage enter" key="docs">
      <h2>Upload documents</h2>
      <p className="sub">Photos from your phone are fine. Each one is checked by AI in seconds; a visa expert reviews everything before filing.</p>
      <div className="vx-people">
        {app.travellers.map((t) => {
          const have = t.docs.filter((x) => x.uploaded.length).length;
          const pct = t.docs.length ? Math.round((have / t.docs.length) * 100) : 100;
          return (
            <div key={t.index} className="vx-person">
              <button type="button" className="vx-person-head" aria-expanded={open === t.index} onClick={() => setOpen(open === t.index ? -1 : t.index)}>
                <span className="vx-avatar">{t.name[0]?.toUpperCase()}</span>
                <span><b>{t.name}</b><small>{t.complete ? "All documents uploaded" : `${have} of ${t.docs.length} documents`}</small></span>
                <span className="vx-ring" style={{ ["--v" as string]: pct }} data-l={`${pct}%`} />
              </button>
              {open === t.index && (
                <div className="vx-person-body">
                  {t.docs.map((d) => <Dropzone key={d.kind + d.label} d={d} traveller={t.index} missionId={app.missionId!} token={app.token} canUpload={app.canUpload} onDone={() => router.refresh()} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!app.canUpload && <div className="vx-note" style={{ marginTop: 14 }}>To upload, open this page on the device you applied from, or sign in with {app.email}.</div>}
      <div className="vx-actions">
        <span style={{ color: "var(--mute)", fontSize: 14 }}>{done} of {app.travellers.length} traveller{app.travellers.length > 1 ? "s" : ""} complete</span>
        <button className="vx-btn primary lg" onClick={() => setView("review")}>{done === app.travellers.length ? "Continue to payment" : "Review & pay"} <Icon name="arrow" size={18} /></button>
      </div>
    </div>
  );

  const missing = app.travellers.flatMap((t) => t.docs.filter((d) => !d.uploaded.length).map((d) => `${t.name}: ${d.label}`));
  return (
    <div className="vx-stage enter" key="review">
      <h2>Review &amp; pay</h2>
      <p className="sub">Check everything is in, then pay securely. We file within one working day.</p>
      <div className="vx-people">
        {app.travellers.map((t) => (
          <div key={t.index} className="vx-trav" style={{ gridTemplateColumns: "40px 1fr auto" }}>
            <span className="vx-avatar">{t.name[0]?.toUpperCase()}</span>
            <span><b>{t.name}</b><br /><small style={{ color: "var(--mute)" }}>{t.docs.filter((x) => x.uploaded.length).length} of {t.docs.length} documents</small></span>
            <span className={`vx-badge ${t.complete ? "visa_free" : "pop"}`}>{t.complete ? "✓ Ready" : "Missing items"}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && <div className="vx-note warn" style={{ marginTop: 14 }}>Still to upload: {missing.slice(0, 4).join("; ")}{missing.length > 4 ? ` and ${missing.length - 4} more` : ""}. You can pay now and add them after; we file once everything is in.</div>}
      <div style={{ marginTop: 18 }}>
        {app.awaitingPrice ? (
          <div className="vx-note ok"><Icon name="clock" /><span><b>We&apos;re confirming the government fee.</b> Our visa team checks the official fee for your dates within one working day and notifies you by email and on your phone. Nothing to pay until then. Our fee for this application: {money(app.serviceTotal)} incl. GST.</span></div>
        ) : app.payPath ? (
          <PayButton refCode={app.ref} token={app.token} label={`Pay ${money(app.balance)} securely`} />
        ) : <div className="vx-note ok"><Icon name="check" /><span>Paid. Our visa team takes it from here.</span></div>}
      </div>
      <div className="vx-actions"><button type="button" className="vx-btn ghost" onClick={() => setView("docs")}>← Documents</button><span className="vx-assure"><span><Icon name="lock" /> Razorpay · UPI, cards, net banking</span></span></div>
    </div>
  );
}
