import Link from "next/link";
import { ADDRESS_ONE_LINE, COMPANY } from "@/lib/company";

export const LEGAL_UPDATED = "24 November 2026";
const DOCS = [
  { href: "/legal/terms", label: "Terms of booking" },
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/legal/cancellation", label: "Cancellations & refunds" },
  { href: "/legal/cookies", label: "Cookies" },
];

/** Shared frame for the legal pages: title, date, side navigation and company footer. */
export default function LegalPage({ title, intro, current, children }: { title: string; intro: string; current: string; children: React.ReactNode }) {
  return (
    <div className="wrap legal-page">
      <aside className="legal-nav" aria-label="Legal">
        {DOCS.map((d) => <Link key={d.href} href={d.href} aria-current={d.href === current ? "page" : undefined}>{d.label}</Link>)}
      </aside>
      <article className="legal-doc">
        <span className="kicker">Legal</span>
        <h1>{title}</h1>
        <p className="legal-meta">Last updated {LEGAL_UPDATED}</p>
        <p className="legal-intro">{intro}</p>
        {children}
        <section>
          <h2>Contact</h2>
          <p>{COMPANY.legalName} (CIN {COMPANY.cin}), {ADDRESS_ONE_LINE}. Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. We don&apos;t have a phone line; you can also reach us any time through Riya on this website.</p>
        </section>
      </article>
    </div>
  );
}
