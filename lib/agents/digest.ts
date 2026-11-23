import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { DigestItem } from "../email-templates";

/**
 * Riya writes the subject line and a short opening for each traveller's note.
 * The facts (prices, dates, references) are never rewritten by the model:
 * they're rendered from the alerts as-is below the intro.
 */
const Note = z.object({
  subject: z.string().describe("Email subject, under 70 characters, specific, no emoji"),
  intro: z.string().describe("One or two warm, plain sentences that lead with the most urgent item. No greeting."),
});

const PROMPT = `You are Riya, the travel agent at Ribriz Travel (India). Write the subject and opening of today's update email to a traveller.
Rules:
- Lead with the most time-sensitive item (an ending hold, a visa deadline, a sold-out date), else the best saving.
- Use only facts from the updates below. Never invent prices, dates or promises.
- Plain, friendly English, like a good human agent. No emoji, no exclamation marks in the subject.
- The full details are shown under your intro, so don't repeat every number.
- The email already starts with "Hi <name>," so begin the intro straight after the greeting, with no greeting of your own.`;

let client: Anthropic | null = null;

export function fallbackNote(items: DigestItem[]) {
  const first = items[0];
  return {
    subject: items.length > 1 ? `${first.title} (+${items.length - 1} more)` : first.title,
    intro: items.length > 1 ? "Here's what changed on your trip since yesterday. The most urgent one is first." : "Here's an update on your trip.",
  };
}

export async function writeNote(name: string | null, items: DigestItem[]): Promise<{ subject: string; intro: string; ai: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ...fallbackNote(items), ai: false };
  try {
    client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 1000,
      output_config: { effort: "low", format: zodOutputFormat(Note) },
      system: PROMPT,
      messages: [{ role: "user", content: `Traveller's first name: ${name?.split(" ")[0] ?? "unknown"}\n\nUpdates, most urgent first:\n${items.map((i, n) => `${n + 1}. ${i.title}: ${i.body}`).join("\n")}` }],
    });
    const out = res.parsed_output;
    if (res.stop_reason === "refusal" || !out || !out.subject.trim() || !out.intro.trim()) return { ...fallbackNote(items), ai: false };
    // the template adds the greeting; drop one the model added anyway
    const intro = out.intro.trim().replace(/^(hi|hello|hey|dear)\b[^,.!]{0,40}[,.!]\s*/i, "");
    return { subject: out.subject.trim().slice(0, 90), intro: (intro.charAt(0).toUpperCase() + intro.slice(1)).slice(0, 400), ai: true };
  } catch (e) {
    console.error("digest note failed, using template", (e as Error).message);
    return { ...fallbackNote(items), ai: false };
  }
}
