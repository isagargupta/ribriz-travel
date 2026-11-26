"use client";
import { track } from "@/lib/client/track";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import ApprovalCard, { type ApprovalCardData } from "./ApprovalCard";
import { uploadToMission } from "@/lib/client/compress";
import { ActionChips, AskForm, TripCarousel, WorkTrail } from "./AgentUi";
import { blockAsText, type Step, type UiBlock } from "@/lib/assistant/ui";

interface Card { slug: string; title: string; image: string; dest: string; country: string; nights: number; price: number; date?: string | null; seats?: number | null; visa?: string }
interface Msg { role: "user" | "assistant"; content: string; cards?: Card[]; approvals?: ApprovalCardData[]; mission?: { id: string; title: string }; error?: boolean; note?: boolean; steps?: Step[]; ui?: UiBlock[] }

const KEY = "ribriz_chat_v1";
const SUGGESTIONS = [
  { icon: "🧭", label: "Plan a trip for me", say: "Plan a new trip for me" },
  { icon: "🔥", label: "Find this month's best deals", say: "Show me the best deals right now" },
  { icon: "🛂", label: "Check my visa", say: "Check what visa I need for my next trip" },
  { icon: "💱", label: "Sort my forex", say: "I need forex for my trip" },
];

/** Opens the assistant from anywhere: window.dispatchEvent(new CustomEvent("ribriz:ask", { detail: "question" })) */
export function askRiya(question?: string) {
  window.dispatchEvent(new CustomEvent("ribriz:ask", { detail: question }));
}

/** Tells the traveller app that Riya changed something (a trip, a card, a booking), so it can refresh. */
export const announceChange = () => window.dispatchEvent(new Event("ribriz:changed"));

/* ---------- tiny safe markdown: **bold**, links, bullet lists ---------- */
function inline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)|((?:https?:\/\/www\.ribriztravel\.com)?\/(?:trips|visa|plan|booking|account|hub|me|you|pay)[^\s)]*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<b key={`${key}b${i++}`}>{m[1]}</b>);
    else {
      const href = (m[3] ?? m[4]).replace(/^https?:\/\/www\.ribriztravel\.com/, "") || "/";
      const label = m[2] ?? (href.startsWith("/trips/") ? "see trip" : href);
      parts.push(href.startsWith("/") ? <Link key={`${key}l${i++}`} href={href}>{label}</Link> : <a key={`${key}l${i++}`} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Rich({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => { if (list.length) { blocks.push(<ul key={"u" + k}>{list.map((l, j) => <li key={j}>{inline(l, `u${k}-${j}`)}</li>)}</ul>); list = []; } };
  text.split("\n").forEach((line, k) => {
    const b = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (b) { list.push(b[1]); return; }
    flush(k);
    if (line.trim()) blocks.push(<p key={"p" + k}>{inline(line.replace(/^#+\s*/, ""), "p" + k)}</p>);
  });
  flush(9999);
  return <>{blocks}</>;
}

/**
 * Riya's chat. On the public site it's a floating panel; inside the traveller
 * app it's docked beside the dashboard (`docked`), always open, and everything
 * she does shows up on the dashboard straight away.
 */
export default function Assistant({ docked = false, onClose }: { docked?: boolean; onClose?: () => void } = {}) {
  const { from, passport, adults, childAges, currency, money, ready, me } = usePrefs();
  const path = usePathname();
  const [openState, setOpen] = useState(false);
  const open = docked || openState;
  const tripHref = (id: string) => (docked || me ? `/me/trips/${id}` : `/hub/${id}`);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // remember the chat for this browser tab
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setMsgs(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { if (!busy) try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-24))); } catch {} }, [msgs, busy]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: busy ? "auto" : "smooth" }); }, [msgs, status, busy]);
  useEffect(() => { if (open) setTimeout(() => box.current?.focus(), 60); }, [open]);
  useEffect(() => {
    if (!open || docked) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, docked]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true); setStatus("Thinking…");
    track(history.filter((m) => m.role === "user").length === 1 ? "chat_open" : "chat_message");
    const ctrl = new AbortController(); abort.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApi(history), context: { from, passport, adults, childAges, currency } }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        patch((m) => ({ ...m, content: j.error || "Sorry, I couldn't answer just now. Please try again.", error: true }));
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line) as { t: string; v?: unknown };
          if (e.t === "text") { setStatus(""); patch((m) => ({ ...m, content: m.content + (e.v as string) })); }
          else if (e.t === "retract") patch((m) => ({ ...m, content: m.content.slice(0, Math.max(0, m.content.length - (e.v as number))) }));
          else if (e.t === "status") setStatus((e.v as string) || "Thinking…");
          else if (e.t === "step") { const st = e.v as Step; patch((m) => ({ ...m, steps: [...(m.steps ?? []).filter((x) => x.id !== st.id), st] })); }
          else if (e.t === "ui") patch((m) => ({ ...m, ui: [...(m.ui ?? []), e.v as UiBlock] }));
          else if (e.t === "cards") patch((m) => ({ ...m, cards: dedupe([...(m.cards ?? []), ...(e.v as Card[])]) }));
          else if (e.t === "approval") patch((m) => ({ ...m, approvals: [...(m.approvals ?? []), e.v as ApprovalCardData] }));
          else if (e.t === "mission") patch((m) => ({ ...m, mission: e.v as { id: string; title: string } }));
          else if (e.t === "error") patch((m) => ({ ...m, content: (m.content ? m.content + "\n\n" : "") + (e.v as string), error: !m.content }));
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") patch((m) => ({ ...m, content: m.content || "You seem to be offline. Please try again.", error: !m.content }));
    } finally {
      setBusy(false); setStatus(""); abort.current = null;
      announceChange(); // tools may have started a trip, prepared a card or saved a preference
    }
  }, [busy, msgs, from, passport, adults, childAges, currency]);

  /** A document dropped into the chat goes to the current trip, is checked, and Riya is told the result. */
  async function attach(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      const fromChat = [...msgs].reverse().find((m) => m.mission)?.mission?.id;
      const id = fromChat ?? (await fetch("/api/missions/current", { cache: "no-store" }).then((r) => r.json()).catch(() => null))?.id;
      if (!id) {
        setMsgs((all) => [...all, { role: "assistant", note: true, content: "Tell me about your trip first, and I'll set up a plan to keep your documents in." }]);
        return;
      }
      const { doc } = await uploadToMission(id, f);
      await send(`📎 I've uploaded my ${doc.label.toLowerCase()}. Automatic check: ${doc.status === "ok" ? "looks good" : doc.status === "unreadable" ? "couldn't be read" : "needs attention"}. ${doc.findings.join(" ")}`);
    } catch (e) {
      setMsgs((all) => [...all, { role: "assistant", note: true, error: true, content: (e as Error).message }]);
    } finally {
      setUploading(false);
      if (fileIn.current) fileIn.current.value = "";
    }
  }

  // other parts of the site can open the chat with a question
  useEffect(() => {
    const onAsk = (e: Event) => { setOpen(true); const q = (e as CustomEvent<string | undefined>).detail; if (q) setTimeout(() => send(q), 120); };
    window.addEventListener("ribriz:ask", onAsk);
    return () => window.removeEventListener("ribriz:ask", onAsk);
  }, [send]);

  if (path.startsWith("/admin")) return null;
  const closeOnPhone = () => { if (window.innerWidth < 640) (onClose ?? (() => setOpen(false)))(); };
  const first = me?.name?.split(" ")[0];

  return (
    <>
      {!docked && (
        <button className={`ai-launch ${open ? "hide" : ""}`} onClick={() => setOpen(true)} aria-label="Ask Riya, our travel assistant" aria-expanded={open}>
          <span className="ai-dot" aria-hidden="true">✦</span><span className="ai-launch-text">Ask Riya</span>
        </button>
      )}

      {open && (
        <div className={`ai-panel ${docked ? "docked" : ""}`} role={docked ? "complementary" : "dialog"} aria-label="Riya, your travel agent">
          <header className="ai-head">
            {docked ? <span className="mini-orb ai-orb" aria-hidden="true" /> : <span className="ai-avatar" aria-hidden="true">R</span>}
            <div><b>Riya</b><small>{busy ? status || "Working…" : docked ? "Your AI travel agent · actions show up here instantly" : "Ribriz AI travel assistant"}</small></div>
            {msgs.length > 0 && <button className="link-btn" onClick={() => { abort.current?.abort(); setMsgs([]); }} disabled={busy}>New chat</button>}
            {(!docked || onClose) && <button className="icon-btn" onClick={() => (onClose ?? (() => setOpen(false)))()} aria-label="Close assistant">×</button>}
          </header>

          <div className="ai-list" ref={list} aria-live="polite">
            {msgs.length === 0 && (
              <div className="ai-hello pop-in">
                <p><b>Hi{first ? ` ${first}` : ""}! I&apos;m Riya, your travel agent.</b> Tell me what you want, or tap one. I&apos;ll do the searching, pricing, holds and paperwork.</p>
                <div className="ai-tiles">
                  {SUGGESTIONS.map((s, i) => <button key={s.label} style={{ ["--i" as string]: i }} onClick={() => send(s.say)} disabled={!ready}><span aria-hidden="true">{s.icon}</span>{s.label}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => {
              const last = i === msgs.length - 1;
              const working = busy && last && m.role === "assistant";
              const answeredLater = msgs.slice(i + 1).some((x) => x.role === "user");
              const legacyCards = m.cards?.length ? [{ kind: "trips" as const, id: `c${i}`, items: m.cards.map((c) => ({ ...c, date: c.date ?? null, seats: c.seats ?? null })) }] : [];
              return (
              <Fragment key={i}>
                {m.role === "assistant" && (m.steps?.length || (working && !m.content)) ? (
                  <WorkTrail steps={m.steps?.length ? m.steps : [{ id: "think", label: status || "Thinking…", state: "run" }]} working={working} />
                ) : null}
                {(m.role === "user" || m.content || m.error) && (
                  <div className={`ai-msg ${m.role} ${m.error ? "err" : ""} ${m.note ? "note" : ""}`}>
                    {m.role === "assistant" ? <Rich text={m.content} /> : <p style={{ whiteSpace: "pre-line" }}>{m.content}</p>}
                  </div>
                )}
                {[...legacyCards, ...(m.ui ?? [])].map((b) =>
                  b.kind === "ask" ? <AskForm key={b.id} block={b} locked={answeredLater} onSubmit={send} />
                  : b.kind === "trips" ? <TripCarousel key={b.id} block={b} onSay={send} onNavigate={closeOnPhone} />
                  : !answeredLater && !working ? <ActionChips key={b.id} block={b} onSay={send} onNavigate={closeOnPhone} /> : null)}
                {m.mission && (
                  <Link className="ai-mission" href={tripHref(m.mission.id)} onClick={closeOnPhone}>
                    <span aria-hidden="true">🧭</span><span><b>{m.mission.title}</b><small>Trip plan started · {docked ? "it's on your dashboard" : "open your trip hub"}</small></span><span aria-hidden="true">→</span>
                  </Link>
                )}
                {m.approvals?.map((a) => (
                  <ApprovalCard key={a.id} card={a} compact onDecided={(o) => { announceChange(); setMsgs((all) => [
                    // remember the outcome on the card itself so it stays correct after a reload
                    ...all.map((x) => (x.approvals?.some((y) => y.id === a.id) ? { ...x, approvals: x.approvals.map((y) => (y.id === a.id ? { ...y, status: o.status } : y)) } : x)),
                    { role: "assistant", note: true, content: o.status === "done" ? `✓ Approved: ${a.summary}. ${o.message}` : `Not now: ${a.summary}.` },
                  ]); }} />
                ))}
              </Fragment>
              );
            })}
          </div>

          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input ref={fileIn} type="file" accept="image/*,application/pdf" hidden onChange={(e) => attach(e.target.files?.[0])} />
            <button type="button" className="ai-attach" onClick={() => fileIn.current?.click()} disabled={busy || uploading} aria-label="Upload a document (passport, photo, statement)" title="Upload a document">
              {uploading ? <span className="spinner dark" aria-label="Uploading" /> : "📎"}
            </button>
            <textarea ref={box} rows={1} value={input} maxLength={2000} placeholder="Ask about trips, prices or visas…" aria-label="Message"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
            {busy
              ? <button type="button" className="ai-send stop" onClick={() => abort.current?.abort()} aria-label="Stop">■</button>
              : <button className="ai-send" disabled={!input.trim()} aria-label="Send">↑</button>}
          </form>
          <p className="ai-fine">AI answers can be wrong. Prices and dates come from live Ribriz data; confirm visas on official sites. <Link href="/legal/privacy" target="_blank">Privacy</Link></p>
        </div>
      )}
    </>
  );
}

/** Plain-text history for the API: notes about approvals are folded into the assistant turn before them. */
function toApi(history: Msg[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    // what Riya put on screen counts as part of what she said
    const content = [m.content.trim(), ...(m.ui ?? []).map(blockAsText)].filter(Boolean).join("\n");
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.slice(-20);
}

function dedupe(cards: Card[]) {
  const seen = new Set<string>();
  return cards.filter((c) => { const k = c.slug + (c.date ?? ""); if (seen.has(k)) return false; seen.add(k); return true; });
}
