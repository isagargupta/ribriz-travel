"use client";
import { useEffect, useState } from "react";
import type { VisaRuleDTO } from "@/lib/visa";

// one download per passport per page visit, shared by every component
const cache = new Map<string, Promise<VisaRuleDTO[]>>();

function load(passport: string) {
  if (!cache.has(passport)) {
    cache.set(passport, fetch(`/api/visa/${passport}`).then((r) => (r.ok ? r.json() : [])).catch(() => {
      cache.delete(passport);
      return [];
    }));
  }
  return cache.get(passport)!;
}

/** Visa rules for a passport; uses server-provided rules first to avoid a flash. */
export function useVisaRules(passport: string, initial?: { passport: string; rules: VisaRuleDTO[] }) {
  const seed = initial && initial.passport === passport ? initial.rules : null;
  const [rules, setRules] = useState<VisaRuleDTO[] | null>(seed);
  useEffect(() => {
    if (initial && initial.passport === passport) { setRules(initial.rules); return; }
    let live = true;
    setRules(null);
    load(passport).then((r) => { if (live) setRules(r); });
    return () => { live = false; };
  }, [passport, initial]);
  return rules;
}
