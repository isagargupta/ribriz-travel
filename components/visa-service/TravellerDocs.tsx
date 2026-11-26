"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApplicationView } from "@/lib/visa-service";

const ICON: Record<string, string> = { passport: "🛂", photo: "🖼️", bank_statement: "🏦", itr: "🧾", employment_proof: "💼", cover_letter: "✉️", insurance: "🛡️", flight_booking: "✈️", hotel_booking: "🏨", other: "📄" };

/** Each traveller's required documents, with upload (camera on phones) and the instant AI check result. */
export default function TravellerDocs({ app, canUpload }: { app: Pick<ApplicationView, "missionId" | "travellers" | "token">; canUpload: boolean }) {
  const router = useRouter();
  const [who, setWho] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const t = app.travellers[who];

  async function upload(kind: string, file: File) {
    if (!app.missionId) return;
    setBusy(kind); setMsg(null);
    const body = new FormData(); body.append("file", file); body.append("kind", kind); body.append("applicant", String(who));
    try {
      const r = await fetch(`/api/missions/${app.missionId}/docs`, { method: "POST", body });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Upload failed.");
      setMsg(j.doc.status === "ok" ? { ok: true, text: `✓ ${j.doc.label}: looks good.` } : { ok: false, text: `${j.doc.label}: ${j.doc.findings?.[0] ?? "needs a second look."}` });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  return (
    <div className="vz-docs-up">
      {app.travellers.length > 1 && (
        <div className="vz-who" role="tablist" aria-label="Traveller">
          {app.travellers.map((x) => <button key={x.index} role="tab" aria-selected={who === x.index} className={who === x.index ? "on" : ""} onClick={() => { setWho(x.index); setMsg(null); }}>{x.complete ? "✓ " : ""}{x.name}</button>)}
        </div>
      )}
      <ul>
        {t.docs.map((d) => {
          const last = d.uploaded[0];
          const state = !last ? "todo" : last.status === "ok" ? "ok" : last.status === "checking" ? "checking" : "issue";
          return (
            <li key={d.kind + d.label} className={`vz-doc ${state}`}>
              <span className="vz-doc-ico" aria-hidden="true">{state === "ok" ? "✓" : ICON[d.kind] ?? "📄"}</span>
              <span className="vz-doc-txt">
                <b>{d.label}</b>
                {state === "todo" ? (d.note && <small>{d.note}</small>) : (
                  <small>{last.fileName} · {state === "ok" ? "checked ✓" : state === "checking" ? "checking…" : last.findings[0] ?? "needs attention"}</small>
                )}
              </span>
              {canUpload && (
                <label className={`btn sm ${state === "todo" ? "hot" : ""} ${busy === d.kind ? "disabled" : ""}`}>
                  {busy === d.kind ? "Checking…" : state === "todo" ? "Upload" : "Replace"}
                  <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(d.kind, f); e.target.value = ""; }} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {msg && <p className={msg.ok ? "ok-txt" : "warn-txt"} role="status">{msg.text}</p>}
      {!canUpload && <p className="muted" style={{ fontSize: 14 }}>To upload, open this page on the device you applied from, or sign in with the email you applied with.</p>}
    </div>
  );
}
