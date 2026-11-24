import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { prisma } from "./db";
import { visaChecklist } from "./documents";
import { rankWork } from "./inbox-rules";
import { TYPE_LABELS } from "./inbox";
import { fmt } from "./pricing";
import { getProfile } from "./profile";
import { describePrefs } from "./profile-rules";
import { detailLines } from "./service-fields";

/**
 * The team co-pilot: reads everything we know about one request and drafts
 * the reply (email and WhatsApp) plus the next steps. A person always reviews
 * and sends; nothing goes out automatically.
 */
const Draft = z.object({
  subject: z.string().describe("Email subject, specific, under 70 characters, include the reference"),
  email: z.string().describe("Email body in plain text. Greeting with first name, short paragraphs, sign off as 'Ribriz Travel team'. No placeholders in brackets unless a fact is genuinely unknown."),
  whatsapp: z.string().describe("The same message for WhatsApp: under 600 characters, friendly, no subject"),
  next_steps: z.array(z.string()).describe("2–5 concrete things the team member should do, in order"),
  ask_customer: z.array(z.string()).describe("Details still missing that the reply asks for (empty if none)"),
});
export type DraftOut = z.infer<typeof Draft>;

const PROMPT = `You are the co-pilot for Ribriz Travel's customer team (an Indian travel company). Draft the team's next message to the customer about one request, and list the next steps for the team member.
Rules:
- Use only facts from the request file below. Never invent prices, fares, availability, visa decisions or partner names. If a price or option isn't in the file, say the team will send it, or ask for what's missing.
- Do the obvious next thing for this request (the "Suggested next action" line), e.g. confirm a hold and ask for the deposit, ask for missing details, nudge to choose an option, share booking confirmation details.
- Sound like a helpful human agent: warm, concise, Indian English, rupee amounts as ₹1,23,456. No emoji in email; at most one in WhatsApp.
- Respect what we know about the traveller's preferences (e.g. vegetarian) when relevant, without being creepy.
- Never include passport or document numbers.
- Ribriz has no phone line: never offer, promise or ask to schedule a call. Everything is done by email (hello@ribriztravel.com) or chat with Riya. Ask the customer to reply to the email.`;

let client: Anthropic | null = null;

/** Everything about a request in plain text, for the model (and for debugging). */
export async function requestFile(enquiryId: string) {
  const e = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: {
      offers: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "desc" }, take: 5 },
      mission: { include: { tasks: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 8 } } },
    },
  });
  if (!e) return null;
  const now = new Date();
  const work = rankWork({
    type: e.type, status: e.status, createdAt: e.createdAt, quotedTotal: e.quotedTotal, departure: e.departure,
    lastTeamMessageAt: e.messages.find((m) => m.channel !== "note")?.createdAt ?? null,
    chosenUnbooked: e.offers.some((o) => o.status === "chosen"), optionsWaiting: e.offers.some((o) => o.status === "offered" && o.validUntil > now),
  }, now);
  const L: string[] = [
    `Today: ${now.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })} (India)`,
    `Reference: ${e.ref} · ${TYPE_LABELS[e.type] ?? e.type} · status ${e.status} · received ${e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}`,
    `Customer: ${e.name} (first name ${e.name.split(" ")[0]})`,
    e.tripTitle ? `Trip: ${e.tripTitle}${e.departure ? `, departing ${e.departure}` : ""}` : "",
    `Travellers: ${e.adults} adult(s)${e.children ? `, ${e.children} child(ren)` : ""}${e.fromCity ? `, from ${e.fromCity}` : ""}`,
    e.quotedTotal ? `Quoted total: ${fmt(e.quotedTotal)} incl. GST${e.type === "hold" ? " (free 48-hour price hold; 10% deposit to book, rest 30 days before travel)" : ""}` : "",
    e.details ? `Request details:\n${detailLines(e.type, JSON.parse(e.details)).map((l) => `  - ${l}`).join("\n")}` : "",
    e.message && !e.details ? `Customer's message: ${e.message}` : "",
    e.offers.length ? `Options sent:\n${e.offers.map((o) => `  - [${o.status}] ${o.title}${o.priceInr ? ` ${fmt(o.priceInr)}` : ""}${o.confirmation ? ` · confirmation ${o.confirmation}` : ""} · valid until ${o.validUntil.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}`).join("\n")}` : "",
    e.messages.length ? `Our previous messages (newest first):\n${e.messages.map((m) => `  - ${m.createdAt.toISOString().slice(0, 16)} ${m.channel}: ${m.subject ? m.subject + " — " : ""}${m.body.slice(0, 200)}`).join("\n")}` : "No messages sent to the customer yet.",
    e.note ? `Internal note: ${e.note}` : "",
  ];
  if (e.mission) {
    const m = e.mission;
    L.push(`Trip plan (handled with Riya, our AI agent):\n${m.tasks.map((t) => `  - ${t.title}: ${t.status}${t.note ? ` (${t.note.slice(0, 140)})` : ""}`).join("\n")}`);
    L.push(`Recent timeline:\n${m.events.map((v) => `  - ${v.actor}: ${v.message.slice(0, 140)}`).join("\n")}`);
    if (e.type === "visa") {
      const c = await visaChecklist({ customerId: m.customerId, anonId: m.anonId, email: null, name: null, phone: null }, m.id).catch(() => null);
      if (c) L.push(`Visa documents: ${c.ready}/${c.needed} ready. ${c.items.filter((i) => !i.byRibriz).map((i) => `${i.label}: ${i.state}${i.doc?.findings.length ? ` (${i.doc.findings.join(" ")})` : ""}`).join("; ")}`);
    }
    const p = await getProfile({ customerId: m.customerId, anonId: m.anonId, email: null, name: null, phone: null });
    const prefs = [...describePrefs(p.prefs), ...p.notes.map((n) => n.text)];
    if (prefs.length) L.push(`What we know about the traveller: ${prefs.join("; ")}`);
  }
  if (work) L.push(`Why it's in the queue: ${work.reasons.join("; ") || "open request"}`, `Suggested next action: ${work.next}`);
  return { enquiry: e, text: L.filter(Boolean).join("\n") };
}

export async function draftReply(enquiryId: string): Promise<DraftOut | { error: string }> {
  const file = await requestFile(enquiryId);
  if (!file) return { error: "Request not found." };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Drafting needs ANTHROPIC_API_KEY." };
  try {
    client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Draft) },
      system: PROMPT,
      messages: [{ role: "user", content: `Request file:\n${file.text}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return { error: "Couldn't draft this one. Write it yourself or try again." };
    return res.parsed_output;
  } catch (e) {
    console.error("copilot draft failed", (e as Error).message);
    return { error: "Drafting is unavailable right now. Try again in a minute." };
  }
}
