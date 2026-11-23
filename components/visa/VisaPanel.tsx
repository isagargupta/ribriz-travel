"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Checklist, ChecklistItem } from "@/lib/documents";
import { uploadToMission } from "@/lib/client/compress";
import { askRiya } from "../assistant/Assistant";

const STATE: Record<ChecklistItem["state"], { label: string; cls: string }> = {
  ok: { label: "Checked ✓", cls: "good" }, issue: { label: "Needs a fix", cls: "warn" }, checking: { label: "Checking…", cls: "ok" },
  missing: { label: "To upload", cls: "neutral" }, by_ribriz: { label: "We provide it ✓", cls: "good" }, after_hold: { label: "We provide after booking", cls: "neutral" },
};

/** Visa document checklist with upload and AI checks, on the trip hub. */
export default function VisaPanel({ missionId, initial }: { missionId: string; initial: Checklist }) {
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const r = await fetch(`/api/missions/${missionId}/docs`, { cache: "no-store" });
    if (r.ok) setC(await r.json());
  }, [missionId]);
  useEffect(() => { const t = setInterval(reload, 30000); return () => clearInterval(t); }, [reload]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const kind = pending.current;
    setBusy(kind ?? "other"); setErr(null);
    try { await uploadToMission(missionId, f, kind); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  }
  const pick = (kind?: string) => { pending.current = kind; input.current?.click(); };
  async function remove(id: string) {
    await fetch(`/api/docs/${id}`, { method: "DELETE" });
    await reload();
  }

  if (c.noVisaWork) {
    return (
      <div className="visa-ok">
        <b>No visa paperwork needed in advance.</b>
        <ul>{c.countries.map((x) => <li key={x.country}>{x.country}: {x.type}{x.days ? ` · up to ${x.days} days` : ""}</li>)}</ul>
        <p className="fine">Carry your passport (valid 6+ months after you return), return ticket and hotel booking. Confirm on the official site before you travel.</p>
      </div>
    );
  }

  return (
    <div className="vpanel">
      <div className="vp-head">
        <div>
          {c.countries.map((x) => <span key={x.country} className="vt warn">{x.country}: {x.type} · ~{x.processing} days</span>)}
        </div>
        <div className="vp-progress" aria-label={`${c.ready} of ${c.needed} documents ready`}>
          <b>{c.ready}/{c.needed}</b><small>ready</small>
        </div>
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" capture={undefined} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <ul className="vp-list">
        {c.items.map((i) => (
          <li key={i.kind} className={`vp-${i.state}`}>
            <div className="vp-main">
              <b>{i.label}{!i.required && <small className="muted"> · if asked</small>}</b>
              <small className="muted">{i.why}</small>
              {i.doc && i.doc.findings.length > 0 && !i.byRibriz && (
                <ul className="vp-find">{i.doc.findings.map((f, n) => <li key={n}>{f}</li>)}</ul>
              )}
              {i.doc && !i.byRibriz && (
                <span className="vp-file"><a href={`/api/docs/${i.doc.id}`} target="_blank" rel="noopener noreferrer">{i.doc.fileName}</a> · <button className="link-btn" onClick={() => remove(i.doc!.id)}>Delete</button></span>
              )}
            </div>
            <div className="vp-side">
              <span className={`vt ${STATE[i.state].cls}`}>{busy === i.kind ? "Checking…" : STATE[i.state].label}</span>
              {!i.byRibriz && (
                <button className="btn sm" disabled={!!busy} onClick={() => pick(i.kind)}>
                  {busy === i.kind ? <span className="spinner dark" aria-label="Checking" /> : i.doc ? "Replace" : "Upload"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {err && <p className="appr-err" role="alert">{err}</p>}
      <div className="vp-foot">
        <button className="btn sm" disabled={!!busy} onClick={() => pick(undefined)}>Upload something else</button>
        {c.allReady
          ? <button className="btn hot" onClick={() => askRiya("All my visa documents are uploaded and checked. Please send them to the visa team.")}>Send to our visa team</button>
          : <button className="btn" onClick={() => askRiya("Help me with my visa documents. What's still missing and how do I get it right?")}>Ask Riya for help</button>}
      </div>
      <p className="fine">Documents are stored privately, opened only by you and our visa team, and deleted automatically 30 days after your trip. AI checks catch common problems; the consulate makes the final decision.</p>
    </div>
  );
}
