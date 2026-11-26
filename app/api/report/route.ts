import { createHash } from "node:crypto";
import { z } from "zod";
import { clientIp, rateLimited } from "@/lib/http";
import { alertTeam } from "@/lib/health";

export const dynamic = "force-dynamic";
const Body = z.object({ message: z.string().max(500), path: z.string().max(200), digest: z.string().max(60).nullish() });

/** A page crashed in someone's browser: tell the team (at most once an hour per distinct error). */
export async function POST(req: Request) {
  try {
    if (process.env.E2E === "1" || (await rateLimited("report:" + clientIp(req), 10))) return new Response(null, { status: 204 });
    const d = Body.parse(await req.json());
    const key = "web:" + createHash("sha1").update(d.path.split("?")[0] + d.message.replace(/\d+/g, "#")).digest("hex").slice(0, 16);
    await alertTeam(key, `Page error on ${d.path.split("?")[0]}`, `A visitor's browser showed the error page.\nPage: ${d.path}\nDigest: ${d.digest ?? "-"}\nBrowser: ${req.headers.get("user-agent") ?? "-"}\n\n${d.message}`);
  } catch { /* never fail */ }
  return new Response(null, { status: 204 });
}
