import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Extract, type Extracted } from "./doc-rules";
export { judge, type CheckContext, type CheckResult } from "./doc-rules";

/**
 * Reads an uploaded travel document with Claude and checks it against the trip.
 * Claude only extracts what it sees; the pass/fail rules (validity windows,
 * dates) are plain code below, so they're predictable and testable.
 */



const PROMPT = `You check travel documents for a visa application. Look at the file and fill in the fields.
- Identify the document type. A passport is the photo/bio page. A "photo" is a passport-style portrait photo on its own.
- Never write out passport numbers, account numbers or other ID numbers anywhere, including the summary.
- Only report what you can actually see. Use null when a field isn't visible.
- Fill only the section matching the document type (passport, photo or statement); set the others to null.`;

let client: Anthropic | null = null;

export async function extract(file: Buffer, mime: string): Promise<Extracted> {
  client ??= new Anthropic();
  const data = file.toString("base64");
  const media: Anthropic.ContentBlockParam = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp", data } };
  const res = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Extract) },
    messages: [{ role: "user", content: [media, { type: "text", text: PROMPT }] }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("unreadable");
  return res.parsed_output;
}

