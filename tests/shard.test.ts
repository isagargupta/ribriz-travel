import { test } from "node:test";
import assert from "node:assert/strict";
import { inShard, mergeStats, shardCount, shardOf } from "../lib/agents/shard.ts";

test("every key lands in exactly one slice, spread fairly", () => {
  const n = 8, counts = new Array(n).fill(0);
  for (let k = 0; k < 8000; k++) {
    const key = `traveller${k}@example.com`;
    const hits = Array.from({ length: n }, (_, i) => inShard(key, { i, n })).filter(Boolean).length;
    assert.equal(hits, 1);
    counts[shardOf(key, n)]++;
  }
  for (const c of counts) assert.ok(c > 800 && c < 1200, `uneven slice: ${c}`);
});

test("slicing is stable and case-insensitive; no slicing means everything", () => {
  assert.equal(inShard("A@B.com", { i: shardOf("a@b.com", 5), n: 5 }), true);
  assert.equal(inShard("x", null), true);
  assert.equal(inShard("x", { i: 0, n: 1 }), true);
});

test("slice count grows with work and is capped", () => {
  assert.equal(shardCount(0), 1);
  assert.equal(shardCount(1500), 1);
  assert.equal(shardCount(1501), 2);
  assert.equal(shardCount(100000), 24);
});

test("worker stats add up", () => {
  const m = mergeStats([{ new: 2, byKind: { price_drop: 1 }, detectorErrors: ["a"] }, { new: 3, byKind: { price_drop: 2, sold_out: 1 }, detectorErrors: [] }]);
  assert.deepEqual(m, { new: 5, byKind: { price_drop: 3, sold_out: 1 }, detectorErrors: ["a"] });
});
