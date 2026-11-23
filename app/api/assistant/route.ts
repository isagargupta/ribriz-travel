import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { contextMessage, SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import { runTool, TOOLS, TOOL_STATUS, type VisitorContext } from "@/lib/assistant/tools";
import { currentCustomer } from "@/lib/customer";
import { clientIp, fail, rateLimited } from "@/lib/http";
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
 * Chat with the travel assistant. Streams newline-delimited JSON events:
 *   {t:"status", v}  a tool is running ("Searching trips…")
 *   {t:"text", v}    a piece of the reply
 *   {t:"cards", v}   trips to show under the reply
 *   {t:"done"} | {t:"error", v}
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("The assistant isn't switched on yet. Please try again later or call us.", 503);
  if (rateLimited("ai:" + clientIp(req), 20)) return fail("You're sending messages quickly. Please wait a few minutes.", 429);

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return fail("Invalid request."); }
  const turns = body.messages;
  if (turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return fail("Invalid conversation.");
  if (turns.reduce((n, m) => n + m.content.length, 0) > 16000) return fail("This chat is getting long. Start a new one to continue.");

  const me = await currentCustomer().catch(() => null);
  const ctx: VisitorContext = { ...body.context, name: me?.name ?? null };

  // Earlier turns go back as plain text (no thinking blocks), which the API accepts;
  // inside this reply the tool loop appends the model's content unchanged.
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m) => ({ role: m.role, content: m.content }));
  messages.push({
    role: "system",
    content: contextMessage({
      from: ctx.from, passport: ctx.passport, passportName: countryName(ctx.passport), adults: ctx.adults, childAges: ctx.childAges,
      currency: ctx.currency, rate: RATES[ctx.currency as Currency], name: ctx.name, today: isoDate(new Date()),
    }),
  });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
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

          run.on("text", (delta) => send({ t: "text", v: delta }));
          const msg = await run.finalMessage();

          if (msg.stop_reason === "refusal") {
            send({ t: "text", v: "\n\nSorry, I can't help with that one. Our team can, though: call us or send a request at /plan." });
            break;
          }
          const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (msg.stop_reason !== "tool_use" || calls.length === 0) break;

          messages.push({ role: "assistant", content: msg.content });
          for (const c of calls) send({ t: "status", v: TOOL_STATUS[c.name] ?? "Looking that up…" });
          const outcomes = await Promise.all(calls.map((c) => runTool(c.name, c.input, ctx)));
          const cards = outcomes.flatMap((o) => o.cards ?? []);
          if (cards.length) send({ t: "cards", v: cards });
          // all results for this round go back together in one user message
          messages.push({
            role: "user",
            content: calls.map((c, n) => ({
              type: "tool_result" as const,
              tool_use_id: c.id,
              content: JSON.stringify(outcomes[n].result),
              ...(outcomes[n].isError ? { is_error: true } : {}),
            })),
          });
          send({ t: "status", v: "" });
        }
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
