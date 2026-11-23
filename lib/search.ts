// Typo-tolerant search used by the search palette and the trips page.
// Pure and dependency-free so it runs instantly in the browser.

const strip = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ");

export const tokenize = (s: string) => strip(s).split(/\s+/).filter(Boolean);

/** Edit distance with transpositions, stopping early once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

/**
 * How well one query token matches one word (0 = no match).
 * Exact > prefix > typo (1–2 edits, scaled by length) > substring.
 */
function tokenScore(q: string, word: string): number {
  if (word === q) return 10;
  if (word.startsWith(q)) return 8 - Math.min(3, (word.length - q.length) / 4);
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    const d = editDistance(q, word.slice(0, q.length + allowed), allowed);
    if (d <= allowed) return 6 - d * 1.5;
  }
  if (q.length >= 3 && word.includes(q)) return 4;
  return 0;
}

export interface Field { text: string; weight: number }

/** Score a record: every query token must match some field word. Returns 0 if any token misses. */
export function scoreFields(query: string, fields: Field[]): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const fieldWords = fields.map((f) => ({ words: tokenize(f.text), weight: f.weight }));
  let total = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const f of fieldWords) for (const w of f.words) best = Math.max(best, tokenScore(qt, w) * f.weight);
    if (best === 0) return 0;
    total += best;
  }
  return total / qTokens.length;
}

export function searchItems<T>(query: string, items: T[], fields: (t: T) => Field[], limit = 20): T[] {
  if (!query.trim()) return [];
  return items
    .map((it) => ({ it, s: scoreFields(query, fields(it)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}

/** Standard field set for trips. */
export const tripFields = (t: { dest: string; country: string; region: string; title: string; themes: string[] }): Field[] => [
  { text: t.dest, weight: 3 },
  { text: t.country, weight: 2.5 },
  { text: t.region, weight: 1.5 },
  { text: t.title, weight: 1.2 },
  { text: t.themes.join(" "), weight: 1 },
];
