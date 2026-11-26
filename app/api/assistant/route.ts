import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { contextMessage, SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import { runTool, stepDone, TOOLS, TOOL_STATUS, UI_TOOLS, type VisitorContext } from "@/lib/assistant/tools";
import { missionsForContext } from "@/lib/missions";
import { noticesFor } from "@/lib/notifications";
import { watchesFor } from "@/lib/watches";
import { getProfile } from "@/lib/profile";
import { describePrefs } from "@/lib/profile-rules";
import { getOwner } from "@/lib/owner";
import { clientIp, dayKey, fail, rateLimited } from "@/lib/http";
import { RIYA_LIMITS } from "@/lib/limits";
import { FROM_CITIES, RATES, isoDate, type Currency } from "@/lib/pricing";
import { countryName } from "@/lib/visa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) })).min(1).max(24),
  context: z.object({
    from: z.string().refine((c) => c in FROM_CITIES).catch("Mumbai"),
    passport: z.string().regex(/^[A-Z]{2}$/).catch("IN"),
    adults: z.number().int().min(1).max(9).catch(2),
    childAges: z.array(z.number().int().min(0).max(11)).max(6).catch([]),
    currency: z.enum(["INR", "EUR", "PLN"]).catch("INR"),
  }).catch({ from: "Mumbai", passport: "IN", adults: 2, childAges: [], currency: "INR" }),
});

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * Chat with the travel agent. Streams newline-delimited JSON events:
 *   {t:"mission", v}  a trip mission was started
 *   {t:"approval", v} an action is ready for the traveller to approve
 *   {t:"status", v}  a tool is running ("Searching trips…")
 *   {t:"text", v}    a piece of the reply
 *   {t:"retract", v} remove the last v characters (a working note before a tool call)
 *   {t:"step", v}    a step of Riya's work: {id, label, state: run|done|error, detail}
 *   {t:"ui", v}      an interactive block: a question form, a trip carousel or next-step buttons
 *   {t:"done"} | {t:"error", v}
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("The assistant isn't switched on yet. Please try again later or email hello@ribriztravel.com.", 503);
  const ip = clientIp(req);
  if (await rateLimited("ai:" + ip, 20)) return fail("You're sending messages quickly. Please wait a few minutes.", 429);

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return fail("Invalid request."); }
  const turns = body.messages;
  if (turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return fail("Invalid conversation.");
  if (turns.reduce((n, m) => n + m.content.length, 0) > 16000) return fail("This chat is getting long. Start a new one to continue.");

  // gives first-time visitors a browser id so their missions persist without sign-up
  const owner = await getOwner(true);
  // daily caps keep the AI bill bounded: per traveller, per network, and for the whole site
  const day = dayKey(), DAY = 26 * 3600e3;
  const who = owner.customerId ? `c:${owner.customerId}` : owner.anonId ? `a:${owner.anonId}` : `ip:${ip}`;
  if (await rateLimited(`ai-day:${who}:${day}`, owner.customerId ? RIYA_LIMITS.signedIn : RIYA_LIMITS.guest, DAY))
    return fail(owner.customerId ? "You've reached today's limit for chatting with Riya. She'll be back tomorrow; for anything urgent, email hello@ribriztravel.com." : "You've reached today's limit for chatting with Riya. Sign in to keep going, or come back tomorrow.", 429, { limit: "daily" });
  if (await rateLimited(`ai-day:ip:${ip}:${day}`, RIYA_LIMITS.network, DAY)) return fail("Lots of messages from this network today. Please try again tomorrow or email hello@ribriztravel.com.", 429, { limit: "daily" });
  if (await rateLimited(`ai-day:all:${day}`, RIYA_LIMITS.site, DAY)) {
    console.error("Riya site-wide daily cap reached", day);
    return fail("Riya is very busy right now. Please try again in a little while or email hello@ribriztravel.com.", 503, { limit: "site" });
  }
  const ctx: VisitorContext = { ...body.context, name: owner.name, owner };
  const [missions, alerts, watches, profile] = await Promise.all([missionsForContext(owner), noticesFor(owner, { take: 5, sinceDays: 7 }), watchesFor(owner), getProfile(owner)]);

  // Earlier turns go back as plain text (no thinking blocks), which the API accepts;
  // inside this reply the tool loop appends the model's content unchanged.
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m) => ({ role: m.role, content: m.content }));
  messages.push({
    role: "system",
    content: contextMessage({
      from: ctx.from, passport: ctx.passport, passportName: countryName(ctx.passport), adults: ctx.adults, childAges: ctx.childAges,
      currency: ctx.currency, rate: RATES[ctx.currency as Currency], name: ctx.name, today: isoDate(new Date()),
      signedIn: !!owner.customerId, missions, alerts: alerts.map((a) => ({ title: a.title, at: a.at })), watches: watches.length,
      memory: [...describePrefs(profile.prefs), ...profile.notes.map((n) => `Note: ${n.text}`)],
    }),
  });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        // trips found by searches; shown only if Riya doesn't present her own picks
        const found = new Map<string, Record<string, unknown>>();
        let presented = false;
        let visible = 0; // characters of reply the traveller can currently see
        let worked = false; // ran at least one real tool
        let owed: Anthropic.Beta.BetaToolResultBlockParam[] | null = null; // results not yet sent back when the loop stopped on buttons
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const run = getClient().beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default", // if the model declines, Anthropic retries on a suitable fallback model
            output_config: { effort: "low" }, // chat: quick, concise replies
            cache_control: { type: "ephemeral" },
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          }, { signal: req.signal });

          let roundChars = 0;
          run.on("text", (delta) => { roundChars += delta.length; visible += delta.length; send({ t: "text", v: delta }); });
          const msg = await run.finalMessage();

          if (msg.stop_reason === "refusal") {
            send({ t: "text", v: "\n\nSorry, I can't help with that one. Our team can, though: send them a request at /plan." });
            break;
          }
          const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (msg.stop_reason !== "tool_use" || calls.length === 0) break;
          const onlyUi = calls.every((c) => UI_TOOLS.has(c.name));
          const ending = calls.some((c) => c.name === "ask" || c.name === "suggest_actions" || c.name === "show_trips");
          // text written before data tools alone is a working note ("let me check…"); text that comes with
          // on-screen blocks is the answer, so it stays even when a data tool runs in the same step
          if (roundChars && !onlyUi && !ending) { send({ t: "retract", v: roundChars }); visible -= roundChars; }
          if (!onlyUi) worked = true;

          messages.push({ role: "assistant", content: msg.content });
          for (const c of calls) if (!UI_TOOLS.has(c.name)) send({ t: "step", v: { id: c.id, label: TOOL_STATUS[c.name] ?? "Looking that up…", state: "run" } });
          const outcomes = await Promise.all(calls.map(async (c) => {
            const o = await runTool(c.name, c.input, ctx);
            if (!UI_TOOLS.has(c.name)) {
              const s = stepDone(c.name, o);
              send({ t: "step", v: { id: c.id, label: s.label, detail: s.detail, state: s.failed ? "error" : "done" } });
            }
            return o;
          }));
          for (const o of outcomes) {
            for (const card of o.cards ?? []) found.set(`${card.slug}|${card.date ?? ""}`, card as unknown as Record<string, unknown>);
            for (const b of o.ui ?? []) { if (b.kind === "trips") presented = true; send({ t: "ui", v: b }); }
            if (o.mission) send({ t: "mission", v: o.mission });
            if (o.approval) send({ t: "approval", v: o.approval });
            for (const a of o.approvals ?? []) send({ t: "approval", v: a });
          }
          const results = calls.map((c, n) => ({
            type: "tool_result" as const,
            tool_use_id: c.id,
            content: JSON.stringify(outcomes[n].result),
            ...(outcomes[n].isError ? { is_error: true } : {}),
          }));
          // finished once Riya hands the turn back with a form or next-step buttons
          if (onlyUi && calls.some((c) => c.name === "ask" || c.name === "suggest_actions")) { owed = results; break; }
          // all results for this round go back together in one user message
          messages.push({ role: "user", content: results });
        }
        // Never leave the traveller with only buttons: if Riya did work but no words are on screen,
        // ask her (with tools off) for the short answer.
        if (visible < 20 && worked && !req.signal.aborted) {
          if (owed) messages.push({ role: "user", content: owed });
          else if (messages[messages.length - 1]?.role === "assistant") messages.push({ role: "user", content: [{ type: "text", text: "(continue)" }] });
          messages.push({ role: "user", content: [{ type: "text", text: "[System] The traveller can see your steps and buttons but no words from you. In 1–3 short sentences, tell them what you found or did and answer their question directly (including what you can and can't do). Don't call tools." }] });
          const fin = getClient().beta.messages.stream({
            model: MODEL, max_tokens: 600, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
            output_config: { effort: "low" }, system: SYSTEM_PROMPT, tools: TOOLS, tool_choice: { type: "none" }, messages,
          }, { signal: req.signal });
          fin.on("text", (delta) => send({ t: "text", v: delta }));
          await fin.finalMessage();
        }
        if (!presented && found.size) send({ t: "ui", v: { kind: "trips", id: `found-${Date.now().toString(36)}`, items: [...found.values()].slice(0, 6) } });
        send({ t: "done" });
      } catch (err) {
        if (req.signal.aborted) { controller.close(); return; }
        console.error("assistant failed", err);
        const msg = err instanceof Anthropic.RateLimitError
          ? "I'm a little busy right now. Please try again in a minute."
          : err instanceof Anthropic.APIError
            ? "Something went wrong on our side. Please try again."
            : "Something went wrong. Please try again.";
        send({ t: "error", v: msg });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
