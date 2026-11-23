"use client";
import { useState, useTransition } from "react";
import { draftReplyAction, sendReplyAction } from "@/app/admin/actions";

type Draft = { subject: string; email: string; whatsapp: string; next_steps: string[]; ask_customer: string[] };

/** Riya drafts the reply; the team member edits, then sends by email or WhatsApp. */
export default function Copilot({ enquiryId, phone, email }: { enquiryId: string; phone: string; email: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"email" | "whatsapp" | "note">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [wa, setWa] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drafting, startDraft] = useTransition();
  const [sending, startSend] = useTransition();
  const [done, setDone] = useState<boolean[]>([]);

  const makeDraft = () => startDraft(async () => {
    setMsg(null);
    const r = await draftReplyAction(enquiryId);
    if ("error" in r) { setMsg({ ok: false, text: r.error }); return; }
    setDraft(r); setSubject(r.subject); setBody(r.email); setWa(r.whatsapp); setDone(r.next_steps.map(() => false));
  });

  const send = (channel: "email" | "whatsapp" | "note") => startSend(async () => {
    setMsg(null);
    const text = channel === "email" ? body : channel === "whatsapp" ? wa : note;
    if (channel === "whatsapp") window.open(`https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    const r = await sendReplyAction({ enquiryId, channel, subject, body: text, drafted: !!draft && channel !== "note" });
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    if (r.ok && channel === "note") setNote("");
  });

  if (!draft) {
    return (
      <div className="cp-bar">
        <button className="btn sm cp-draft" onClick={makeDraft} disabled={drafting}>{drafting ? <><span className="spinner" /> Riya is drafting…</> : "✨ Draft reply with Riya"}</button>
        <button className="btn sm" onClick={() => { setDraft({ subject: "", email: "", whatsapp: "", next_steps: [], ask_customer: [] }); }}>Write my own</button>
        {msg && <span className={msg.ok ? "cp-ok" : "appr-err"}>{msg.text}</span>}
      </div>
    );
  }

  return (
    <div className="cp">
      {draft.next_steps.length > 0 && (
        <div className="cp-steps">
          <b>Next steps</b>
          <ol>{draft.next_steps.map((s, i) => <li key={i}><label><input type="checkbox" checked={done[i] ?? false} onChange={() => setDone(done.map((d, j) => (j === i ? !d : d)))} /> <span className={done[i] ? "cp-done" : ""}>{s}</span></label></li>)}</ol>
          {draft.ask_customer.length > 0 && <p className="muted" style={{ margin: "6px 0 0" }}>The reply asks for: {draft.ask_customer.join(", ")}</p>}
        </div>
      )}
      <div className="cp-tabs" role="tablist">
        {(["email", "whatsapp", "note"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} className="cp-tab" onClick={() => setTab(k)}>{k === "email" ? "Email" : k === "whatsapp" ? "WhatsApp" : "Internal note"}</button>)}
      </div>
      {tab === "email" && (
        <div className="cp-pane">
          <input className="in" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" />
          <textarea className="in" rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" aria-label="Email message" />
          <div className="cp-act"><span className="muted">To {email}</span><button className="btn blue" disabled={sending || !body.trim() || !subject.trim()} onClick={() => send("email")}>{sending ? "Sending…" : "Send email"}</button></div>
        </div>
      )}
      {tab === "whatsapp" && (
        <div className="cp-pane">
          <textarea className="in" rows={6} value={wa} onChange={(e) => setWa(e.target.value)} placeholder="WhatsApp message" aria-label="WhatsApp message" />
          <div className="cp-act"><span className="muted">Opens WhatsApp to {phone} with this text</span><button className="btn blue" disabled={sending || !wa.trim()} onClick={() => send("whatsapp")}>Open WhatsApp</button></div>
        </div>
      )}
      {tab === "note" && (
        <div className="cp-pane">
          <textarea className="in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only the team sees this, e.g. 'Called, will pay deposit tonight'" aria-label="Internal note" />
          <div className="cp-act"><span /><button className="btn" disabled={sending || !note.trim()} onClick={() => send("note")}>Save note</button></div>
        </div>
      )}
      <div className="cp-bar">
        <button className="link-btn" onClick={makeDraft} disabled={drafting}>{drafting ? "Redrafting…" : "↻ Redraft"}</button>
        {msg && <span className={msg.ok ? "cp-ok" : "appr-err"} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}
