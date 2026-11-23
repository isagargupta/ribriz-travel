import "server-only";
import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";
import { firstError } from "./schemas";

/** Tiny in-memory limiter: N requests per window per key. Per server instance; resets on restart. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > limit;
}

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
