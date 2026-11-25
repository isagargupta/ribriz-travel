import "server-only";
import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";
import { firstError } from "./schemas";

/* ---------- rate limits ---------- */

/** In-memory fallback, used only if the database can't be reached. Per server instance. */
const hits = new Map<string, number[]>();
function localLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > limit;
}

/**
 * Counts one request for `key` and returns how many there have been in the
 * current window. Shared by every server instance (one atomic row in Postgres),
 * so limits hold however many copies of the app are running.
 */
export async function countHit(key: string, windowMs: number): Promise<number> {
  const { prisma } = await import("./db");
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateHit" ("key", "count", "resetAt") VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateHit"."resetAt" <= now() THEN 1 ELSE "RateHit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateHit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateHit"."resetAt" END
    RETURNING "count"`;
  return Number(rows[0].count);
}

/** True when `key` has gone over `limit` requests in the window (default 10 minutes). */
export async function rateLimited(key: string, limit = 8, windowMs = 10 * 60 * 1000) {
  try { return (await countHit(key, windowMs)) > limit; }
  catch (e) { console.error("rate limit store unavailable", e); return localLimited(key, limit, windowMs); }
}

/** Calendar day (UTC) for daily caps, e.g. "2026-11-25". */
export const dayKey = () => new Date().toISOString().slice(0, 10);

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

/** Parse a JSON body with a schema; returns data or a ready-made error response. */
export async function readJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.output<S> } | { res: NextResponse }> {
  let body: unknown;
  try { body = await req.json(); } catch { return { res: fail("Invalid request.") }; }
  const r = schema.safeParse(body);
  return r.success ? { data: r.data } : { res: fail(firstError(r.error)) };
}
