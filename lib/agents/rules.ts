// Decision rules for the background agents. Pure, so they're unit-tested.
import { daysBetween } from "../pricing.ts";

/** A drop is worth telling someone about: at least ₹1,000 and at least 2%. */
export function isMeaningfulDrop(before: number, now: number) {
  const drop = before - now;
  return drop >= 1000 && drop / before >= 0.02;
}

/** Holds last 48 hours: warn in the last ~18 hours, then offer a re-hold for 2 days. */
export function holdStage(createdAt: Date, now: Date): "expiring" | "expired" | null {
  const h = (now.getTime() - createdAt.getTime()) / 3600e3;
  if (h >= 30 && h < 48) return "expiring";
  if (h >= 48 && h < 96) return "expired";
  return null;
}

/** Visa reminder when the start-by date is within 14 days (or passed). Weekly bucket stops repeats. */
export function visaReminder(dueDate: string | null, today: string): { daysLeft: number; bucket: number } | null {
  if (!dueDate) return null;
  const daysLeft = daysBetween(today, dueDate);
  if (daysLeft > 14) return null;
  return { daysLeft, bucket: Math.floor(daysBetween("2026-01-05", today) / 7) };
}

/** Missing documents: remind every 4 days once departure is within 60 days. */
export function docsReminder(departure: string | null, today: string): { bucket: number; daysToGo: number } | null {
  if (!departure) return null;
  const daysToGo = daysBetween(today, departure);
  if (daysToGo < 0 || daysToGo > 60) return null;
  return { bucket: Math.floor(daysBetween("2026-01-01", today) / 4), daysToGo };
}

/** Pre-trip checklist goes out once, 0–3 days before departure. */
export const isPreTrip = (departure: string | null, today: string) => !!departure && daysBetween(today, departure) >= 0 && daysBetween(today, departure) <= 3;
