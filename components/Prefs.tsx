"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fmt, type Currency } from "@/lib/pricing";

export type PriceMode = "pp" | "total";

interface Prefs {
  currency: Currency;
  from: string;
  adults: number;
  childAges: number[];
  /** show prices per person or as the total for the whole party */
  priceMode: PriceMode;
  saved: string[];
  compare: string[];
  /** recently viewed trip ids, newest first */
  recent: string[];
}

interface Toast { id: number; msg: string; tone: "info" | "ok" | "err"; action?: { label: string; run: () => void } }

interface PrefsApi extends Prefs {
  ready: boolean;
  set: (p: Partial<Prefs>) => void;
  toggleSaved: (id: string) => boolean;
  toggleCompare: (id: string) => "added" | "removed" | "full";
  addRecent: (id: string) => void;
  toast: (msg: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
  money: (inr: number) => string;
}

const DEFAULTS: Prefs = { currency: "INR", from: "Mumbai", adults: 2, childAges: [], priceMode: "pp", saved: [], compare: [], recent: [] };
const KEY = "ribriz_prefs_v2";
const Ctx = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* storage blocked: keep defaults */ }
    setReady(true);
  }, []);

  // keep tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) try { setP({ ...DEFAULTS, ...JSON.parse(e.newValue) }); } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((part: Partial<Prefs>) => {
    setP((cur) => {
      const next = { ...cur, ...part };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toast = useCallback<PrefsApi["toast"]>((msg, opts) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, msg, tone: opts?.tone ?? "info", action: opts?.action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 5000 : 3200);
  }, []);

  const toggleSaved = useCallback((id: string) => {
    const on = !p.saved.includes(id);
    set({ saved: on ? [id, ...p.saved] : p.saved.filter((x) => x !== id) });
    return on;
  }, [p.saved, set]);

  const toggleCompare = useCallback((id: string): "added" | "removed" | "full" => {
    if (p.compare.includes(id)) { set({ compare: p.compare.filter((x) => x !== id) }); return "removed"; }
    if (p.compare.length >= 3) return "full";
    set({ compare: [...p.compare, id] });
    return "added";
  }, [p.compare, set]);

  const addRecent = useCallback((id: string) => {
    setP((cur) => {
      if (cur.recent[0] === id) return cur;
      const next = { ...cur, recent: [id, ...cur.recent.filter((x) => x !== id)].slice(0, 8) };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const money = useCallback((inr: number) => fmt(inr, p.currency), [p.currency]);

  const api = useMemo(() => ({ ...p, ready, set, toggleSaved, toggleCompare, addRecent, toast, money }),
    [p, ready, set, toggleSaved, toggleCompare, addRecent, toast, money]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role="status">
            <span>{t.msg}</span>
            {t.action && <button onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}
