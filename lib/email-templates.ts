import "server-only";
import { HOLD_HOURS, addDays, fmt, fmtDate } from "./pricing";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
import { ADDRESS_ONE_LINE, COMPANY } from "./company";

interface Built { subject: string; html: string; text: string }

/** Shared layout: table-based so it renders the same in Gmail, Outlook and Apple Mail. */
function layout(opts: { preheader: string; heading: string; body: string; cta?: { label: string; url: string }; unsubscribe?: string }): string {
  const s = site();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;background:#f6f7ff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1240">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7ff;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dfe3fb">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eef0ff"><a href="${s}"><img src="${s}/img/logo.png" alt="Ribriz Travel" height="36" style="height:36px;border:0;display:block"></a></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#0b1240">${esc(opts.heading)}</h1>
${opts.body}
${opts.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="background:#ff5a36;border-radius:999px"><a href="${opts.cta.url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px">${esc(opts.cta.label)}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#eef0ff;font-size:12px;color:#5b628a;line-height:1.6">
<b>Ribriz Travel</b> · <a href="mailto:${COMPANY.email}" style="color:#0b4fc4">${COMPANY.email}</a> · <a href="${s}" style="color:#0b4fc4">ribriztravel.com</a><br>
${COMPANY.legalName} · CIN ${COMPANY.cin}<br>${esc(ADDRESS_ONE_LINE)}<br>
You're receiving this because you used Ribriz Travel. Reply to this email to reach our team.${opts.unsubscribe ? `<br><a href="${opts.unsubscribe}" style="color:#5b628a">Stop trip updates from Riya</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1c2558">${t}</p>`;
const box = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border:1px solid #dfe3fb;border-radius:12px">${rows
    .map(([k, v], i) => `<tr><td style="padding:10px 14px;font-size:13px;color:#5b628a;${i ? "border-top:1px solid #eef0ff;" : ""}width:38%">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:600;${i ? "border-top:1px solid #eef0ff;" : ""}">${v}</td></tr>`)
    .join("")}</table>`;

/* ---------------- templates ---------------- */

export function loginCodeEmail(code: string, forAdmin = false): Built {
  const heading = forAdmin ? "Your admin sign-in code" : "Your sign-in code";
  return {
    subject: `${code} is your Ribriz ${forAdmin ? "admin " : ""}sign-in code`,
    html: layout({
      preheader: `Your code is ${code}. It expires in 10 minutes.`,
      heading,
      body: p("Enter this code to sign in. It expires in 10 minutes.") +
        `<div style="margin:18px 0;padding:16px;text-align:center;background:#eef0ff;border-radius:14px;font-family:Menlo,Consolas,monospace;font-size:34px;letter-spacing:10px;font-weight:700;color:#0b4fc4">${code}</div>` +
        p("If you didn't ask for this, you can ignore this email. Nobody can sign in without the code."),
    }),
    text: `${heading}: ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, ignore this email.`,
  };
}

export interface HoldInfo { ref: string; name: string; tripTitle: string; tripSlug?: string | null; date: string; nights: number; adults: number; children: number; total: number; from?: string | null; deposit?: number }

export function holdConfirmationEmail(h: HoldInfo): Built {
  const ret = addDays(h.date, h.nights);
  const party = `${h.adults} adult${h.adults > 1 ? "s" : ""}${h.children ? `, ${h.children} child${h.children > 1 ? "ren" : ""}` : ""}`;
  const url = `${site()}/booking?ref=${h.ref}`;
  return {
    subject: `Price held: ${h.tripTitle} (${h.ref})`,
    html: layout({
      preheader: `We're holding ${fmt(h.total)} for ${HOLD_HOURS} hours. Reference ${h.ref}.`,
      heading: `Your price is held for ${HOLD_HOURS} hours`,
      body: p(`Hi ${esc(h.name.split(" ")[0])}, thanks for choosing Ribriz. We've reserved this price for you. There's nothing to pay yet.`) +
        box([
          ["Reference", `<span style="font-family:Menlo,Consolas,monospace;color:#0b4fc4">${h.ref}</span>`],
          ["Trip", esc(h.tripTitle)],
          ["Dates", `${fmtDate(h.date)} – ${fmtDate(ret, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`],
          ["Travellers", `${party}${h.from ? ` · from ${esc(h.from)}` : ""}`],
          ["Total incl. GST", fmt(h.total)],
          ...(h.deposit ? [["Deposit to book", fmt(h.deposit)] as [string, string]] : []),
        ]) +
        p("<b>What happens next:</b> a travel expert will confirm flights and rooms by email within 2 working hours. Pay the deposit to book; the rest is due 30 days before you leave."),
      cta: { label: "View my booking", url },
    }),
    text: `Your price is held for ${HOLD_HOURS} hours.\n\nReference: ${h.ref}\nTrip: ${h.tripTitle}\nDates: ${h.date} to ${ret}\nTravellers: ${party}\nTotal incl. GST: ${fmt(h.total)}\n\nA travel expert will confirm flights and rooms by email within 2 working hours.\nView your booking: ${url}`,
  };
}

const SERVICE_COPY: Record<string, { subject: string; heading: string; line: string }> = {
  visa: { subject: "Your visa request", heading: "We're on your visa", line: "a visa expert will contact you within 4 working hours with the exact documents and fee." },
  forex: { subject: "Your forex request", heading: "We're arranging your forex", line: "our forex partner will confirm your rate and delivery within 2 working hours." },
  insurance: { subject: "Your travel insurance request", heading: "We're finding your insurance", line: "we'll send plan options and a quote within 2 working hours." },
  flight: { subject: "Your flight request", heading: "We're finding your flights", line: "we'll send the best fares within 2 working hours." },
  hotel: { subject: "Your hotel request", heading: "We're finding your hotel", line: "we'll send hotel options within 2 working hours." },
};

export function enquiryReceivedEmail(e: { ref: string; name: string; type: string; tripTitle?: string | null; message?: string | null }): Built {
  const svc = SERVICE_COPY[e.type];
  if (svc) {
    return {
      subject: `${svc.subject} (${e.ref})`,
      html: layout({
        preheader: svc.line, heading: svc.heading,
        body: p(`Hi ${esc(e.name.split(" ")[0])}, thanks! ${svc.line.charAt(0).toUpperCase() + svc.line.slice(1)}`) +
          box([["Reference", `<span style="font-family:Menlo,Consolas,monospace;color:#0b4fc4">${e.ref}</span>`], ...(e.tripTitle ? [["Trip", esc(e.tripTitle)] as [string, string]] : [])]) +
          (e.message ? `<div style="margin:12px 0;padding:12px 14px;background:#f6f7ff;border-radius:12px;font-size:14px;white-space:pre-wrap;color:#1c2558">${esc(e.message)}</div>` : ""),
        cta: { label: "Open my trip hub", url: `${site()}/hub` },
      }),
      text: `${svc.heading}. Reference ${e.ref}. ${svc.line}\n${site()}/hub`,
    };
  }
  const custom = e.type === "custom";
  return {
    subject: custom ? `We're planning your trip (${e.ref})` : `We got your question${e.tripTitle ? ` about ${e.tripTitle}` : ""} (${e.ref})`,
    html: layout({
      preheader: custom ? "A travel expert will send a costed plan within one working day." : "A travel expert usually replies within a few hours.",
      heading: custom ? "Your trip request is with our experts" : "Thanks, we got your question",
      body: p(`Hi ${esc(e.name.split(" ")[0])}, ${custom ? "a travel expert will send you a day-by-day plan with a full price within one working day." : "a travel expert will reply within a few hours, usually sooner."}`) +
        box([["Reference", `<span style="font-family:Menlo,Consolas,monospace;color:#0b4fc4">${e.ref}</span>`], ...(e.tripTitle ? [["Trip", esc(e.tripTitle)] as [string, string]] : [])]) +
        (e.message ? `<div style="margin:12px 0;padding:12px 14px;background:#f6f7ff;border-radius:12px;font-size:14px;white-space:pre-wrap;color:#1c2558">${esc(e.message)}</div>` : ""),
      cta: { label: "Check status", url: `${site()}/booking?ref=${e.ref}` },
    }),
    text: `Thanks ${e.name.split(" ")[0]}, we got your ${custom ? "trip request" : "question"}. Reference ${e.ref}.\n${site()}/booking?ref=${e.ref}`,
  };
}

const STATUS_COPY: Record<string, { heading: string; line: string }> = {
  contacted: { heading: "We're working on your trip", line: "Our travel expert has started confirming flights and rooms for you and will be in touch shortly." },
  booked: { heading: "You're booked!", line: "Your deposit is received and your trip is confirmed. We'll send your vouchers and final details before you leave." },
  closed: { heading: "Your request is closed", line: "This request is now closed. If you'd like to pick it up again, just reply to this email." },
};

export function statusUpdateEmail(e: { ref: string; name: string; status: string; tripTitle?: string | null; date?: string | null }): Built | null {
  const c = STATUS_COPY[e.status];
  if (!c) return null;
  return {
    subject: `${c.heading}${e.tripTitle ? `: ${e.tripTitle}` : ""} (${e.ref})`,
    html: layout({
      preheader: c.line,
      heading: c.heading,
      body: p(`Hi ${esc(e.name.split(" ")[0])}, ${c.line.charAt(0).toLowerCase() + c.line.slice(1)}`) +
        box([["Reference", `<span style="font-family:Menlo,Consolas,monospace;color:#0b4fc4">${e.ref}</span>`], ...(e.tripTitle ? [["Trip", esc(e.tripTitle)] as [string, string]] : []), ...(e.date ? [["Departure", fmtDate(e.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })] as [string, string]] : [])]),
      cta: { label: "View my booking", url: `${site()}/booking?ref=${e.ref}` },
    }),
    text: `${c.heading}\n${c.line}\nReference ${e.ref}\n${site()}/booking?ref=${e.ref}`,
  };
}

export function teamAlertEmail(e: { ref: string; type: string; name: string; phone: string; email: string; tripTitle?: string | null; date?: string | null; total?: number | null; travellers: string; message?: string | null }): Built {
  const LABELS: Record<string, string> = { hold: "Price hold", custom: "Custom trip request", enquiry: "Question", visa: "Visa request", forex: "Forex request", insurance: "Insurance request", flight: "Flight request", hotel: "Hotel request" };
  const label = LABELS[e.type] ?? "Request";
  return {
    subject: `New ${label.toLowerCase()}: ${e.name}${e.tripTitle ? ` · ${e.tripTitle}` : ""} (${e.ref})`,
    html: layout({
      preheader: `${label} from ${e.name}. Call ${e.phone}.`,
      heading: `New ${label.toLowerCase()}`,
      body: box([
        ["Reference", e.ref],
        ["Customer", esc(e.name)],
        ["Phone", `<a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>`],
        ["Email", `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`],
        ...(e.tripTitle ? [["Trip", esc(e.tripTitle)] as [string, string]] : []),
        ...(e.date ? [["Departure", e.date] as [string, string]] : []),
        ["Travellers", esc(e.travellers)],
        ...(e.total ? [["Quoted", fmt(e.total)] as [string, string]] : []),
      ]) + (e.message ? `<div style="padding:12px 14px;background:#f6f7ff;border-radius:12px;font-size:14px;white-space:pre-wrap">${esc(e.message)}</div>` : ""),
      cta: { label: "Open in admin", url: `${site()}/admin/enquiries` },
    }),
    text: `New ${label}: ${e.ref}\n${e.name} · ${e.phone} · ${e.email}\n${e.tripTitle ?? ""} ${e.date ?? ""}\n${e.message ?? ""}`,
  };
}

export function welcomeEmail(): Built {
  return {
    subject: "You're on the Ribriz price-drop list",
    html: layout({
      preheader: "We'll email you when there's a deal worth it.",
      heading: "You're in",
      body: p("We'll email you when there's a deal worth it: big price drops and last-minute seats. No spam, and you can unsubscribe any time by replying “unsubscribe”."),
      cta: { label: "See this week's deals", url: `${site()}/trips?deal=lm` },
    }),
    text: `You're on the Ribriz price-drop list. See this week's deals: ${site()}/trips?deal=lm`,
  };
}

export interface DigestItem { title: string; body: string; url: string }

/** Riya's daily note: an intro (AI-written or template) above the facts, which always come from code. */
export function digestEmail(d: { name: string | null; subject: string; intro: string; items: DigestItem[]; unsubscribe: string }): Built {
  const s = site();
  const abs = (u: string) => (u.startsWith("http") ? u : s + u);
  const hi = d.name ? `Hi ${esc(d.name.split(" ")[0])},` : "Hi,";
  const cards = d.items.map((i) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #dfe3fb;border-radius:14px"><tr><td style="padding:14px 16px">
<div style="font-size:15px;font-weight:700;color:#0b1240;margin:0 0 6px">${esc(i.title)}</div>
<div style="font-size:14px;line-height:1.55;color:#1c2558">${esc(i.body)}</div>
<div style="margin-top:10px"><a href="${abs(i.url)}" style="font-size:14px;font-weight:700;color:#0b4fc4;text-decoration:none">Open →</a></div>
</td></tr></table>`).join("");
  return {
    subject: d.subject,
    html: layout({
      preheader: d.items[0]?.title ?? d.subject,
      heading: d.items.length > 1 ? `${d.items.length} updates on your trip` : "An update on your trip",
      body: p(`${hi} ${esc(d.intro)}`) + cards + p("— Riya, your Ribriz travel agent"),
      cta: { label: "Open my trip hub", url: `${s}/hub` },
      unsubscribe: d.unsubscribe,
    }),
    text: `${hi} ${d.intro}\n\n${d.items.map((i) => `• ${i.title}\n  ${i.body}\n  ${abs(i.url)}`).join("\n\n")}\n\n— Riya, Ribriz Travel\nStop these updates: ${d.unsubscribe}`,
  };
}

export interface OfferLine { title: string; lines: string[]; priceInr: number | null }
const offerBox = (o: OfferLine) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #dfe3fb;border-radius:14px"><tr><td style="padding:14px 16px">
<div style="font-size:15px;font-weight:700;color:#0b1240">${esc(o.title)}${o.priceInr ? `<span style="float:right;color:#0b4fc4">${fmt(o.priceInr)}</span>` : ""}</div>
${o.lines.length ? `<div style="margin-top:6px;font-size:14px;line-height:1.55;color:#1c2558">${o.lines.map(esc).join("<br>")}</div>` : ""}
</td></tr></table>`;

/** The team's options for a request, ready to pick in the trip hub. */
export function offersReadyEmail(d: { name: string; label: string; ref: string; offers: OfferLine[]; validUntil: Date; missionId: string }): Built {
  const url = `${site()}/hub/${d.missionId}`;
  const until = d.validUntil.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const n = d.offers.length;
  return {
    subject: `Your ${d.label.toLowerCase()} option${n > 1 ? "s are" : " is"} ready (${d.ref})`,
    html: layout({
      preheader: `${n} option${n > 1 ? "s" : ""} to choose from. One tap in your trip hub and we'll book it.`,
      heading: `Your ${d.label.toLowerCase()} option${n > 1 ? "s are" : " is"} ready`,
      body: p(`Hi ${esc(d.name.split(" ")[0])}, here ${n > 1 ? `are ${n} options` : "is the option"} our team found. Choose in your trip hub and we'll book it for you.`) +
        d.offers.map(offerBox).join("") + p(`Prices are held until <b>${until}</b>.`),
      cta: { label: n > 1 ? "Choose an option" : "Review and approve", url },
    }),
    text: `Your ${d.label.toLowerCase()} options (${d.ref}):\n\n${d.offers.map((o) => `• ${o.title}${o.priceInr ? ` — ${fmt(o.priceInr)}` : ""}\n  ${o.lines.join("\n  ")}`).join("\n\n")}\n\nValid until ${until}. Choose here: ${url}`,
  };
}

/** Booked with the supplier: the confirmation the traveller keeps. */
export function bookingConfirmedEmail(d: { name: string; label: string; ref: string; offer: OfferLine; confirmation: string; missionId: string | null }): Built {
  const url = d.missionId ? `${site()}/hub/${d.missionId}` : `${site()}/booking?ref=${d.ref}`;
  return {
    subject: `Booked: ${d.offer.title} (${d.confirmation})`,
    html: layout({
      preheader: `Confirmation ${d.confirmation}. Everything is in your trip hub.`,
      heading: `Your ${d.label.toLowerCase()} is booked`,
      body: p(`Hi ${esc(d.name.split(" ")[0])}, it's done. Keep this confirmation handy; it's also saved in your trip hub.`) +
        box([["Confirmation", `<span style="font-family:Menlo,Consolas,monospace;color:#0b4fc4">${esc(d.confirmation)}</span>`], ["Our reference", d.ref]]) + offerBox(d.offer),
      cta: { label: "Open my trip hub", url },
    }),
    text: `Your ${d.label.toLowerCase()} is booked.\nConfirmation: ${d.confirmation}\n${d.offer.title}\n${d.offer.lines.join("\n")}\nOur reference: ${d.ref}\n${url}`,
  };
}

/** Team alert: the traveller picked an option, book it now. */
export function offerChosenTeamEmail(d: { ref: string; name: string; phone: string; email: string; label: string; offer: OfferLine; enquiryId: string }): Built {
  return {
    subject: `Book now: ${d.name} chose ${d.offer.title} (${d.ref})`,
    html: layout({
      preheader: `${d.name} chose an option. Book it and add the confirmation.`,
      heading: `${d.label}: option chosen`,
      body: box([["Reference", d.ref], ["Customer", esc(d.name)], ["Phone", `<a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>`], ["Email", esc(d.email)]]) + offerBox(d.offer) +
        p("Book it with the supplier, then add the confirmation in the admin. The traveller sees it straight away."),
      cta: { label: "Open in admin", url: `${site()}/admin/enquiries#${d.enquiryId}` },
    }),
    text: `${d.name} chose ${d.offer.title} (${d.ref}). Book it and add the confirmation: ${site()}/admin/enquiries#${d.enquiryId}`,
  };
}

/** A personal message from the team (written or co-pilot drafted, always reviewed). */
export function teamMessageEmail(d: { subject: string; body: string; ref: string; hubUrl: string | null }): Built {
  const paras = d.body.trim().split(/\n{2,}/).map((para) => p(esc(para).replace(/\n/g, "<br>"))).join("");
  return {
    subject: d.subject,
    html: layout({ preheader: d.body.slice(0, 120), heading: d.subject.replace(/^\s*RB-[A-Z0-9]+\s*[:\-–|]\s*/, "").replace(/\s*[(\[]?RB-[A-Z0-9]+[)\]]?\s*$/, "") || d.subject, body: paras + `<p style="margin:16px 0 0;font-size:12px;color:#5b628a">Reference ${esc(d.ref)} · just reply to this email to reach us.</p>`, cta: d.hubUrl ? { label: "Open my trip hub", url: d.hubUrl } : undefined }),
    text: `${d.body.trim()}\n\nReference ${d.ref}${d.hubUrl ? `\n${d.hubUrl}` : ""}`,
  };
}
