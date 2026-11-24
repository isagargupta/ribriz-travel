import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Cookies" };

const ROWS: [string, string, string][] = [
  ["ribriz_user", "Keeps you signed in", "30 days"],
  ["ribriz_anon", "Remembers trips and preferences in this browser before you sign in", "180 days"],
  ["ribriz_admin", "Keeps Ribriz staff signed in to the admin", "12 hours"],
];
const STORAGE: [string, string][] = [
  ["Preferences", "Currency, price display, departure city, travellers, saved and recently viewed trips"],
  ["Chat", "Your current conversation with Riya, for this tab only"],
  ["Notices", "That you've seen the cookie notice"],
];

export default function Cookies() {
  return (
    <LegalPage current="/legal/cookies" title="Cookies" intro="We use only essential cookies and your browser's storage to make the site work. No advertising cookies, no third-party tracking.">
      <section>
        <h2>Cookies we set</h2>
        <table className="legal-table"><thead><tr><th>Name</th><th>Purpose</th><th>Lasts</th></tr></thead>
          <tbody>{ROWS.map(([n, p, l]) => <tr key={n}><td><code>{n}</code></td><td>{p}</td><td>{l}</td></tr>)}</tbody></table>
      </section>
      <section>
        <h2>Stored in your browser</h2>
        <table className="legal-table"><thead><tr><th>What</th><th>Why</th></tr></thead>
          <tbody>{STORAGE.map(([n, p]) => <tr key={n}><td>{n}</td><td>{p}</td></tr>)}</tbody></table>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can clear cookies and site data in your browser at any time. If you block essential cookies, signing in and saving trips won&apos;t work.</p>
      </section>
    </LegalPage>
  );
}
