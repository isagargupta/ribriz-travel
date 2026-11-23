// Search filters for /trips. Shared by the server page and the client explorer.

export interface Filters {
  kind: string; q: string; theme: string; deal: string; nights: string; date: string; flex: string; sort: string;
  regions: string[]; stars: number[]; boards: string[]; budget: number;
  free: boolean; flight: boolean; beach: boolean; tm: boolean; visa: boolean;
}

export const MAX_BUDGET = 400000;

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? "";
  const list = (k: string) => one(k).split(",").filter(Boolean);
  return {
    kind: one("kind"), q: one("q"), theme: one("theme"), deal: one("deal"), nights: one("nights"), date: one("date"), flex: one("flex"),
    sort: one("sort") || "rec",
    regions: list("region"), stars: list("stars").map(Number).filter(Boolean), boards: list("board"),
    budget: Number(one("budget")) || MAX_BUDGET,
    free: one("free") === "1", flight: one("flight") === "1", beach: one("beach") === "1", tm: one("tm") === "1", visa: one("visa") === "1",
  };
}

export function toQuery(f: Filters) {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | boolean) => { if (v === true) p.set(k, "1"); else if (v && v !== "rec") p.set(k, String(v)); };
  put("kind", f.kind); put("q", f.q); put("theme", f.theme); put("deal", f.deal); put("nights", f.nights); put("date", f.date); put("flex", f.flex); put("sort", f.sort);
  if (f.regions.length) p.set("region", f.regions.join(","));
  if (f.stars.length) p.set("stars", f.stars.join(","));
  if (f.boards.length) p.set("board", f.boards.join(","));
  if (f.budget < MAX_BUDGET) p.set("budget", String(f.budget));
  put("free", f.free); put("flight", f.flight); put("beach", f.beach); put("tm", f.tm); put("visa", f.visa);
  return p.toString();
}
