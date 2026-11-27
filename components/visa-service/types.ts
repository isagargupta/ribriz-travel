import type { VisaKind } from "@/lib/visa-service-rules";

/** What the browser needs to list a destination (kept small: ~190 of these go to the page). */
export interface DestCard {
  slug: string; code: string; country: string; region: string; kind: VisaKind; kindLabel: string;
  stay: number | null; days: number; readyBy: string; from: number; serviceOnly: boolean;
  canApply: boolean; curated: boolean; popular: boolean; appointment: boolean;
}
