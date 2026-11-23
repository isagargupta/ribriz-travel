"use client";
import Link from "next/link";
import { VISA_META, countryName, flag, visaLine, type VisaRuleDTO } from "@/lib/visa";
import { usePrefs } from "../Prefs";
import PassportSelect from "./PassportSelect";
import { useVisaRules } from "./useVisaRules";

interface Props {
  countryCodes: string[];
  visaNote: string | null;
  passports: string[];
  initial: { passport: string; rules: VisaRuleDTO[] };
}

/** Visa needs for every country on a trip, for the visitor's passport. */
export default function VisaBox({ countryCodes, visaNote, passports, initial }: Props) {
  const { passport, ready } = usePrefs();
  const pp = ready ? passport : initial.passport;
  const rules = useVisaRules(pp, initial);
  const rows = countryCodes.map((code) => ({ code, rule: rules?.find((r) => r.d === code) ?? null }));
  const schengen = countryCodes.length > 1 && rows.every((r) => r.rule?.c === "required") && countryCodes.every((c) => SCHENGEN.has(c));

  return (
    <div className="visa-box">
      <div className="vb-head">
        <p className="muted" style={{ margin: 0 }}>Visa needs for your passport. Change it if you&apos;re travelling on another one.</p>
        <PassportSelect passports={passports} id="trip-passport" compact />
      </div>
      {visaNote && <div className="notice warn vb-note"><b>Note from our team:</b> {visaNote}</div>}
      {countryCodes.length === 0 ? <p className="muted">Ask us about visas for this trip.</p> : (
        <ul className="vb-list">
          {rows.map(({ code, rule }) => (
            <li key={code}>
              <span className="fl" aria-hidden="true">{flag(code)}</span>
              <div>
                <b>{countryName(code)}</b>
                {!rules ? <span className="skel-line" style={{ width: 140, margin: "4px 0" }} /> : rule ? (
                  <>
                    <span className={`vt ${VISA_META[rule.c].tone}`}>{visaLine(rule)}</span>
                    <small className="muted">{VISA_META[rule.c].blurb}</small>
                  </>
                ) : <small className="muted">No data for this passport. Ask us.</small>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {schengen && <p className="fine">One Schengen visa covers all of these countries. Apply at the consulate of the country where you&apos;ll spend the most nights. We can help with the forms and appointment.</p>}
      <p className="fine">Rules can change and may depend on other visas you hold. Confirm on the official government website before you travel. <Link href={`/visa${countryCodes[0] ? `?to=${countryCodes[0]}` : ""}`}>Open the visa checker</Link></p>
    </div>
  );
}

const SCHENGEN = new Set(["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"]);
