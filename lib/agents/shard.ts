// Splitting the daily job into slices of travellers that run in parallel. Pure, so it's unit-tested.

/** One slice of the work: slice `i` of `n` (0-based). */
export interface Shard { i: number; n: number }

/** Stable slice number for a key (an email or customer id), FNV-1a hash. */
export function shardOf(key: string, n: number): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < key.length; k++) { h ^= key.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % n;
}

/** True when this key belongs to the slice (or when there's no slicing). */
export const inShard = (key: string | null | undefined, s: Shard | null | undefined) => !s || s.n <= 1 || shardOf((key ?? "").toLowerCase(), s.n) === s.i;

/**
 * How many slices to run: about 1,500 travellers each, so every worker finishes
 * well inside its 5-minute limit, and at most 24 at once.
 */
export function shardCount(workItems: number, perShard = 1500, max = 24) {
  return Math.max(1, Math.min(max, Math.ceil(workItems / perShard)));
}

/** Adds up the numeric stats the workers return; lists are joined. */
export function mergeStats(parts: Record<string, unknown>[]) {
  const out: Record<string, unknown> = {};
  for (const p of parts) for (const [k, v] of Object.entries(p)) {
    if (typeof v === "number") out[k] = ((out[k] as number) ?? 0) + v;
    else if (Array.isArray(v)) out[k] = [...((out[k] as unknown[]) ?? []), ...v];
    else if (v && typeof v === "object") out[k] = mergeStats([(out[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>]);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}
