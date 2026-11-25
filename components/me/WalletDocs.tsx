"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WalletDoc } from "@/lib/wallet";

export const WALLET_CACHE = "ribriz-wallet";
const rawUrl = (id: string) => `/api/docs/${id}?raw=1`;
const KINDS = [
  { kind: "flight_booking", label: "✈️ Flight ticket" },
  { kind: "hotel_booking", label: "🏨 Hotel voucher" },
  { kind: "insurance", label: "🛡️ Insurance" },
  { kind: "other", label: "📄 Other" },
];
const ICON: Record<string, string> = { passport: "🛂", photo: "🖼️", flight_booking: "✈️", hotel_booking: "🏨", insurance: "🛡️", bank_statement: "🏦", itr: "🧾", employment_proof: "💼", cover_letter: "✉️" };
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Documents for one trip: open, save a copy on this device for offline use, add tickets and vouchers. */
/** A small list of what's saved, so the offline page can show it without a connection. */
async function writeIndex(c: Cache, change: (ix: Record<string, { label: string; fileName: string; trip: string }>) => void) {
  const ix = await c.match("/__wallet-index").then((r) => (r ? r.json() : {})).catch(() => ({}));
  change(ix);
  await c.put("/__wallet-index", new Response(JSON.stringify(ix), { headers: { "Content-Type": "application/json" } }));
}

export default function WalletDocs({ missionId, trip, docs }: { missionId: string; trip: string; docs: WalletDoc[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [kind, setKind] = useState("flight_booking");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [canCache, setCanCache] = useState(false); // known only in the browser

  useEffect(() => {
    if (!("caches" in window)) return;
    setCanCache(true);
    caches.open(WALLET_CACHE).then(async (c) => {
      const have = new Set<string>();
      for (const d of docs) if (await c.match(rawUrl(d.id))) have.add(d.id);
      setSaved(have);
    }).catch(() => {});
  }, [docs]);

  async function toggleOffline(d: WalletDoc) {
    setBusy(d.id);
    try {
      const c = await caches.open(WALLET_CACHE);
      if (saved.has(d.id)) { await c.delete(rawUrl(d.id)); await writeIndex(c, (ix) => { delete ix[d.id]; }); setSaved((s) => { const n = new Set(s); n.delete(d.id); return n; }); }
      else {
        const r = await fetch(rawUrl(d.id), { credentials: "same-origin" });
        if (!r.ok) throw new Error();
        await c.put(rawUrl(d.id), r);
        await writeIndex(c, (ix) => { ix[d.id] = { label: d.label, fileName: d.fileName, trip }; });
        setSaved((s) => new Set(s).add(d.id));
      }
    } catch { setMsg({ ok: false, text: "Couldn't save that one. Check your connection and try again." }); }
    setBusy(null);
  }

  async function upload(f: File) {
    setBusy("upload"); setMsg(null);
    const body = new FormData(); body.append("file", f); body.append("kind", kind);
    try {
      const r = await fetch(`/api/missions/${missionId}/docs`, { method: "POST", body });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Upload failed.");
      setMsg({ ok: true, text: `Added ${j.doc.label.toLowerCase()}.` });
      window.dispatchEvent(new Event("ribriz:changed"));
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed." }); }
    setBusy(null);
    if (file.current) file.current.value = "";
  }

  async function remove(d: WalletDoc) {
    if (!confirm(`Delete “${d.fileName}”? This can't be undone.`)) return;
    setBusy(d.id);
    const r = await fetch(`/api/docs/${d.id}`, { method: "DELETE" });
    if (r.ok) { if (canCache) { const c = await caches.open(WALLET_CACHE); await c.delete(rawUrl(d.id)); await writeIndex(c, (ix) => { delete ix[d.id]; }); } router.refresh(); }
    setBusy(null);
  }

  return (
    <div className="w-docs">
      {docs.length === 0 && <p className="muted w-none">No documents yet. Add your e-tickets and vouchers so they&apos;re all in one place.</p>}
      <ul>
        {docs.map((d) => (
          <li key={d.id} className={saved.has(d.id) ? "saved" : ""}>
            <span className="w-ico" aria-hidden="true">{ICON[d.kind] ?? "📄"}</span>
            <a className="w-doc" href={rawUrl(d.id)} target="_blank" rel="noopener">
              <b>{d.label}</b>
              <small className="muted">{d.fileName} · {size(d.size)}{saved.has(d.id) ? " · on this device" : ""}</small>
              {d.status === "issue" && d.findings[0] && <small className="warn-txt">{d.findings[0]}</small>}
            </a>
            {canCache && (
              <button type="button" className={`w-save ${saved.has(d.id) ? "on" : ""}`} disabled={busy === d.id} onClick={() => toggleOffline(d)} aria-pressed={saved.has(d.id)}>
                {busy === d.id ? "…" : saved.has(d.id) ? "✓ Offline" : "Save offline"}
              </button>
            )}
            <button type="button" className="w-del" disabled={busy === d.id} onClick={() => remove(d)} aria-label={`Delete ${d.fileName}`} title="Delete">✕</button>
          </li>
        ))}
      </ul>
      <div className="w-add">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">
          {KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
        <label className={`btn sm ${busy === "upload" ? "disabled" : ""}`}>
          {busy === "upload" ? "Uploading…" : "+ Add file"}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden disabled={busy === "upload"} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {msg && <p className={msg.ok ? "ok-txt" : "warn-txt"} role="status">{msg.text}</p>}
    </div>
  );
}
