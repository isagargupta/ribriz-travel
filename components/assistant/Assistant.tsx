"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/pricing";
import { usePrefs } from "../Prefs";
import ApprovalCard, { type ApprovalCardData } from "./ApprovalCard";
import { uploadToMission } from "@/lib/client/compress";

interface Card { slug: string; title: string; image: string; dest: string; country: string; nights: number; price: number; date?: string | null; seats?: number | null; visa?: string }
interface Msg { role: "user" | "assistant"; content: string; cards?: Card[]; approvals?: ApprovalCardData[]; mission?: { id: string; title: string }; error?: boolean; note?: boolean }

const KEY = "ribriz_chat_v1";
const SUGGESTIONS = [
  "Cheapest beach trip next month where I can get the visa on arrival",
  "Honeymoon under ₹1 lakh per person in December",
  "Do I need a visa for Japan, and how long does it take?",
  "Family trip in India for 6 nights, kids aged 4 and 8",
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
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)|((?:https?:\/\/www\.ribriztravel\.com)?\/(?:trips|visa|plan|booking|account|hub|me|you)[^\s)]*)/g;
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
                <p><b>Hi{first ? ` ${first}` : ""}! I&apos;m Riya.</b> Tell me your budget, dates or dream destination and I&apos;ll find real trips with prices, dates and visa needs for your passport.</p>
                <div className="ai-sugg">
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} disabled={!ready}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <Fragment key={i}>
                <div className={`ai-msg ${m.role} ${m.error ? "err" : ""} ${m.note ? "note" : ""}`}>
                  {m.role === "assistant" ? <Rich text={m.content} /> : <p>{m.content}</p>}
                  {m.role === "assistant" && busy && i === msgs.length - 1 && (
                    <div className="ai-status"><span className="ai-typing"><i /><i /><i /></span>{status}</div>
                  )}
                </div>
                {m.cards && m.cards.length > 0 && (
                  <div className="ai-cards">
                    {m.cards.map((c) => (
                      <Link key={c.slug + (c.date ?? "")} className="ai-card" href={`/trips/${c.slug}${c.date ? `?date=${c.date}` : ""}`} onClick={closeOnPhone}>
                        <span className="ai-card-img"><Image src={c.image} alt="" fill sizes="180px" /></span>
                        <span className="ai-card-body">
                          <b>{c.dest}</b>
                          <small>{c.nights} nights{c.date ? ` · ${fmtDate(c.date, { day: "numeric", month: "short" })}` : ""}</small>
                          <span className="ai-card-price">{money(c.price)} <small>/adult</small></span>
                          {c.visa && <small className="ai-card-visa">Visa: {c.visa}</small>}
                          {c.seats !== null && c.seats !== undefined && c.seats <= 8 && <small className="warn-txt">{c.seats} seats left</small>}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
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
            ))}
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
          <p className="ai-fine">AI answers can be wrong. Prices and dates come from live Ribriz data; confirm visas on official sites.</p>
        </div>
      )}
    </>
  );
}

/** Plain-text history for the API: notes about approvals are folded into the assistant turn before them. */
function toApi(history: Msg[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    if (!m.content.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.slice(-20);
}

function dedupe(cards: Card[]) {
  const seen = new Set<string>();
  return cards.filter((c) => { const k = c.slug + (c.date ?? ""); if (seen.has(k)) return false; seen.add(k); return true; });
}
