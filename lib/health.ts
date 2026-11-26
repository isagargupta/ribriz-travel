import "server-only";
import { resolveMx } from "node:dns/promises";
import { COMPANY } from "./company";
import { prisma } from "./db";
import { rzpConfigured, rzpKeyId, rzpLive, rzpSecret, rzpWebhookSecret } from "./razorpay";

export interface Check { name: string; ok: boolean; detail: string; critical: boolean }

const timed = <T,>(p: Promise<T>, ms = 6000) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms))]);

async function check(name: string, critical: boolean, run: () => Promise<string>): Promise<Check> {
  try { return { name, ok: true, detail: await timed(run()), critical }; }
  catch (e) { return { name, ok: false, detail: (e as Error).message.slice(0, 200), critical }; }
}

/** Is everything the business depends on working? Used by the daily job (emails the team on failure) and /admin/health. */
export async function runChecks(): Promise<Check[]> {
  return Promise.all([
    check("Database", true, async () => { await prisma.$queryRaw`SELECT 1`; return "Connected"; }),
    check("Razorpay keys", true, async () => {
      if (!rzpConfigured()) throw new Error("No Razorpay keys set: online payments are off");
      const r = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: "Basic " + Buffer.from(`${rzpKeyId()}:${rzpSecret()}`).toString("base64") } });
      if (r.status === 401) throw new Error("Razorpay rejected the keys (were they regenerated?)");
      if (!r.ok) throw new Error(`Razorpay answered ${r.status}`);
      return rzpLive() ? "Live keys work" : "Test keys work (no real payments)";
    }),
    check("Razorpay webhook secret", false, async () => { if (!rzpWebhookSecret()) throw new Error("Not set: payments confirmed only in the browser, refunds made in Razorpay aren't recorded"); return "Set"; }),
    check("Riya (Claude API)", true, async () => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY is missing: Riya is off");
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      if (r.status === 401) throw new Error("The API key was rejected");
      if (!r.ok) throw new Error(`Anthropic answered ${r.status}`);
      return "API key works";
    }),
    check("Email (Resend)", true, async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is missing: no emails are sent");
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401 || r.status === 403) throw new Error("Resend rejected the key");
      if (r.ok) {
        const j = (await r.json()) as { data?: { name: string; status: string }[] };
        const d = j.data?.find((x) => COMPANY.email.endsWith("@" + x.name));
        if (d && d.status !== "verified") throw new Error(`Sending domain ${d.name} is ${d.status}`);
      }
      return "Key works";
    }),
    check("Team inbox for alerts", true, async () => { if (!process.env.TEAM_EMAIL) throw new Error("TEAM_EMAIL is empty: booking alerts go nowhere"); return process.env.TEAM_EMAIL.split(",").length + " address(es)"; }),
    check(`${COMPANY.email} receives mail`, false, async () => {
      const mx = await resolveMx(COMPANY.email.split("@")[1]).catch(() => []);
      if (!mx.length) throw new Error("No mail server (MX record): mail to this address bounces");
      return mx.map((m) => m.exchange).join(", ");
    }),
    check("WhatsApp updates", false, async () => {
      if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) throw new Error("Not set up yet (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID): the opt-in stays hidden");
      const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}?fields=display_phone_number,quality_rating`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
      if (!r.ok) throw new Error(`Meta answered ${r.status}: check the token and phone number id`);
      const j = (await r.json()) as { display_phone_number?: string; quality_rating?: string };
      return `${j.display_phone_number ?? "Number"} · quality ${j.quality_rating ?? "unknown"}`;
    }),
    check("Visa fees checked", false, async () => {
      const n = await prisma.visaProduct.count({ where: { published: true, verifiedAt: null } });
      if (n) throw new Error(`${n} published visa${n > 1 ? "s" : ""} not checked against the official fee: Admin → Visas`);
      return "All checked";
    }),
    check("Push notifications", false, async () => { if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error("VAPID keys missing: no push notifications"); return "Configured"; }),
    check("Daily job ran", true, async () => {
      const last = await prisma.agentRun.findFirst({ orderBy: { startedAt: "desc" } });
      if (!last) throw new Error("Never ran");
      const h = (Date.now() - last.startedAt.getTime()) / 3600e3;
      if (h > 26) throw new Error(`Last run ${Math.round(h)} hours ago`);
      if (last.error) throw new Error(`Last run had errors: ${last.error.slice(0, 120)}`);
      return `Ran ${Math.round(h)}h ago`;
    }),
    check("GST invoice numbering", true, async () => {
      const rows = await prisma.$queryRaw<{ kind: string; fy: string; n: bigint; max: number }[]>`SELECT kind, fy, count(*) AS n, max(seq) AS max FROM "Invoice" WHERE number NOT LIKE 'T%' GROUP BY 1, 2`;
      const gaps = rows.filter((r) => Number(r.n) !== r.max);
      if (gaps.length) throw new Error(`Gap in ${gaps.map((g) => `${g.kind} ${g.fy}`).join(", ")}`);
      const P: Record<string, string> = { invoice: "RB", credit_note: "CN", receipt_voucher: "RV", refund_voucher: "RF" };
      return rows.length ? rows.map((r) => `${P[r.kind] ?? r.kind} ${r.fy}: ${r.max}`).join(", ") : "No invoices yet";
    }),
    check("Unsent alert emails", false, async () => {
      const stuck = await prisma.notification.count({ where: { emailedAt: null, email: { not: null }, createdAt: { lt: new Date(Date.now() - 36 * 3600e3), gt: new Date(Date.now() - 7 * 864e5) } } });
      if (stuck) throw new Error(`${stuck} traveller alerts older than 36h were never emailed`);
      return "None waiting";
    }),
  ]);
}

/** Emails the team, at most once per `key` per window, so one failure doesn't flood the inbox. */
export async function alertTeam(key: string, subject: string, body: string, windowMs = 3600e3) {
  try {
    const { rateLimited } = await import("./http");
    if (await rateLimited(`alert:${key}`, 1, windowMs)) return false;
    const { sendEmail, teamInbox } = await import("./email");
    const to = teamInbox();
    if (!to.length) return false;
    await sendEmail({ to, subject: `⚠️ Ribriz: ${subject}`.slice(0, 140), html: `<pre style="font:13px/1.5 Menlo,monospace;white-space:pre-wrap">${body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))}</pre>`, text: body });
    return true;
  } catch (e) { console.error("alertTeam failed", e); return false; }
}

/** Daily: run every check and email the team about failures (once a day each). */
export async function dailyHealth() {
  const checks = await runChecks();
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
    await alertTeam(`health-${new Date().toISOString().slice(0, 10)}`, `${bad.length} system check${bad.length > 1 ? "s" : ""} failing${bad.some((c) => c.critical) ? " (urgent)" : ""}`,
      bad.map((c) => `${c.critical ? "URGENT  " : "        "}${c.name}: ${c.detail}`).join("\n") + `\n\nSee all checks: ${site}/admin/health`, 24 * 3600e3);
  }
  return { checks: checks.length, failing: bad.map((c) => c.name) };
}
