import { Flag } from "./ui";

export const WIZARD_STEPS = ["Trip", "Travellers", "Documents", "Review & pay", "Visa"];

/** The frame every step of an application shares: who/where header, the progress line, the step and the summary. */
export function WizardFrame({ code, country, visa, step, children, summary }: { code: string; country: string; visa: string; step: number; children: React.ReactNode; summary: React.ReactNode }) {
  return (
    <div className="vx-wiz">
      <div className="wrap">
        <div className="vx-wiz-head"><Flag code={code} size={48} /><div><b>{country} visa application</b><small>{visa}</small></div></div>
        <ol className="vx-progress" style={{ ["--p" as string]: step / (WIZARD_STEPS.length - 1) }} aria-label="Application steps">
          {WIZARD_STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><span>{i < step ? "✓" : i + 1}</span>{s}</li>)}
        </ol>
        <div className="vx-wiz-grid">
          <div>{children}</div>
          <aside className="vx-summary">{summary}</aside>
        </div>
      </div>
    </div>
  );
}
