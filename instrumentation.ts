// Next.js calls this for every unhandled server error. The team gets an email
// (at most one per distinct error per hour), so problems at 2am don't wait for a customer.
export async function register() {}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routerKind: string; routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.E2E === "1") return;
  const e = err as Error & { digest?: string };
  const msg = String(e?.message ?? err).slice(0, 500);
  if (/NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR)/.test(msg) || /aborted|ECONNRESET/i.test(msg)) return; // not real errors
  // a short fingerprint of the error (FNV-1a), so the same error isn't emailed twice in an hour
  let h = 0x811c9dc5;
  for (const ch of context.routePath + msg.replace(/\d+/g, "#")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const key = "srv:" + h.toString(36);
  const { alertTeam } = await import("./lib/health");
  await alertTeam(key, `Server error on ${context.routePath}`,
    `${request.method} ${request.path}\nRoute: ${context.routePath} (${context.routeType})\nWhen: ${new Date().toISOString()}\nDigest: ${e?.digest ?? "-"}\n\n${msg}\n\n${String(e?.stack ?? "").split("\n").slice(1, 8).join("\n")}\n\nThe same error won't be emailed again for an hour. Full logs: Vercel → ribriz-travel → Logs.`);
}
