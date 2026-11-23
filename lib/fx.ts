import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Daily market exchange rates (ExchangeRate-API open access: free, no key,
 * attribution required). These are indicative mid-market rates; the forex
 * partner confirms the actual rate, which includes their margin.
 */
export interface FxRates { perInr: Record<string, number>; updated: string; source: string }

export const FX_ATTRIBUTION = { label: "Rates by Exchange Rate API", url: "https://www.exchangerate-api.com" };

// failures throw inside the cache so a bad response is never cached
const cachedRates = unstable_cache(
  async (): Promise<FxRates> => {
    const r = await fetch("https://open.er-api.com/v6/latest/INR", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const j = (await r.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (j.result !== "success" || !j.rates) throw new Error("bad fx response");
    return { perInr: j.rates, updated: new Date(j.time_last_update_utc ?? Date.now()).toISOString(), source: FX_ATTRIBUTION.label };
  },
  ["fx-inr-v1"],
  { revalidate: 6 * 3600 },
);

export async function getFxRates(): Promise<FxRates | null> {
  try { return await cachedRates(); } catch (e) { console.error("fx rates unavailable", (e as Error).message); return null; }
}

/** Rupees for an amount of foreign currency at the market rate, or null if unknown. */
export async function inrFor(currency: string, amount: number) {
  const rates = await getFxRates();
  const per = rates?.perInr[currency.toUpperCase()];
  if (!rates || !per || !(amount > 0)) return null;
  return { inr: Math.round(amount / per), rate: 1 / per, updated: rates.updated };
}
