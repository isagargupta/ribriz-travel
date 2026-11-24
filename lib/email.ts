import "server-only";
import { COMPANY } from "./company";

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** stops duplicate sends if the same request is retried */
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

const FROM = () => process.env.EMAIL_FROM || "Ribriz Travel <hello@ribriztravel.com>";

/**
 * Sends through Resend's HTTP API. Without RESEND_API_KEY (local development)
 * the email is printed to the server console instead, so codes still work.
 * Never throws: email problems must not break a booking.
 */
export async function sendEmail(e: Email): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n✉️  [email not sent: no RESEND_API_KEY]\nTo: ${[e.to].flat().join(", ")}\nSubject: ${e.subject}\n${e.text}\n`);
      return { ok: true, id: "dev" };
    }
    console.error("RESEND_API_KEY is missing; email not sent:", e.subject);
    return { ok: false, error: "Email is not configured." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(e.idempotencyKey ? { "Idempotency-Key": e.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: FROM(), to: [e.to].flat(), subject: e.subject, html: e.html, text: e.text,
        reply_to: e.replyTo ?? COMPANY.email, // customers reply to the public inbox
        ...(e.headers ? { headers: e.headers } : {}),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("Resend error", res.status, j.message);
      return { ok: false, error: j.message || `Email failed (${res.status})` };
    }
    return { ok: true, id: j.id };
  } catch (err) {
    console.error("Resend request failed", err);
    return { ok: false, error: "Email service unreachable." };
  }
}

/** Team inbox(es) for new-enquiry alerts. */
export function teamInbox(): string[] {
  return (process.env.TEAM_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
}
