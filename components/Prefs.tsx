"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Currency } from "@/lib/pricing";

interface Prefs {
  currency: Currency;
  from: string;
  adults: number;
  childAges: number[];
  saved: string[];
  compare: string[];
}

interface PrefsApi extends Prefs {
  set: (p: Partial<Prefs>) => void;
  toggleSaved: (id: string) => boolean;
  toggleCompare: (id: string) => "added" | "removed" | "full";
  toast: (msg: string) => void;
}

const DEFAULTS: Prefs = { currency: "INR", from: "Mumbai", adults: 2, childAges: [], saved: [], compare: [] };
const KEY = "ribriz_prefs_v1";
const Ctx = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const persist = useCallback((next: Prefs) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  }, []);

  const set = useCallback((part: Partial<Prefs>) => setP((cur) => persist({ ...cur, ...part })), [persist]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as unknown as { t?: number }).t);
    (toast as unknown as { t?: number }).t = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const toggleSaved = useCallback((id: string) => {
    const on = !p.saved.includes(id);
    set({ saved: on ? [...p.saved, id] : p.saved.filter((x) => x !== id) });
    return on;
  }, [p.saved, set]);

  const toggleCompare = useCallback((id: string): "added" | "removed" | "full" => {
    if (p.compare.includes(id)) { set({ compare: p.compare.filter((x) => x !== id) }); return "removed"; }
    if (p.compare.length >= 3) return "full";
    set({ compare: [...p.compare, id] });
    return "added";
  }, [p.compare, set]);

  const api = useMemo(() => ({ ...p, set, toggleSaved, toggleCompare, toast }), [p, set, toggleSaved, toggleCompare, toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}
