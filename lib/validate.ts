import "server-only";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^[+()\d\s-]{7,20}$/;

export const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

/** Tiny in-memory limiter: N requests per window per key. Resets on server restart. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function shortRef(id: string) {
  return "RB-" + id.slice(-6).toUpperCase();
}
