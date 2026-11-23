"use client";
import { useMemo } from "react";
import { countryName, flag } from "@/lib/visa";
import { usePrefs } from "../Prefs";

/** Passport picker, remembered across the site. Common choices first. */
export default function PassportSelect({ passports, id = "passport", compact = false }: { passports: string[]; id?: string; compact?: boolean }) {
  const { passport, set } = usePrefs();
  const options = useMemo(() => {
    const top = ["IN", "PL", "GB", "US", "AE"].filter((c) => passports.includes(c));
    const rest = passports.filter((c) => !top.includes(c)).sort((a, b) => countryName(a).localeCompare(countryName(b)));
    return { top, rest };
  }, [passports]);
  return (
    <label className={compact ? "pp-compact" : "lab"} htmlFor={id}>
      {!compact && "Your passport"}
      <select id={id} className="in" value={passport} onChange={(e) => set({ passport: e.target.value })} aria-label="Your passport">
        <optgroup label="Common">{options.top.map((c) => <option key={c} value={c}>{flag(c)} {countryName(c)}</option>)}</optgroup>
        <optgroup label="All countries">{options.rest.map((c) => <option key={c} value={c}>{flag(c)} {countryName(c)}</option>)}</optgroup>
      </select>
    </label>
  );
}
