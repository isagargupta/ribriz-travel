import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Cancellations & refunds" };

export default function Cancellation() {
  return (
    <LegalPage current="/legal/cancellation" title="Cancellations & refunds" intro="How cancelling works for holds, trips and the services we arrange, and how refunds reach you.">
      <section>
        <h2>Price holds</h2>
        <p>Holds are free and end automatically after 48 hours. You can let a hold lapse or tell us to drop it; nothing is charged.</p>
      </section>
      <section>
        <h2>Trips</h2>
        <ul>
          <li><b>Trips marked &ldquo;Free cancellation&rdquo;:</b> cancel at least 30 days before departure and we refund what you&apos;ve paid in full.</li>
          <li><b>Other trips, or later cancellations:</b> cancellation charges apply. They reflect what airlines, hotels and operators charge us, and we show them in your booking confirmation before you pay the deposit.</li>
          <li>To cancel, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with your booking reference, or ask Riya. We confirm the cancellation and the exact refund in writing.</li>
        </ul>
      </section>
      <section>
        <h2>Changes</h2>
        <p>Want different dates or travellers? Ask before cancelling. Changes are often cheaper than cancelling, and any partner charges are confirmed with you first.</p>
      </section>
      <section>
        <h2>Visas, insurance, forex, flights and hotels arranged separately</h2>
        <ul>
          <li><b>Visa:</b> government and service fees are generally not refundable once an application is submitted, whatever the outcome.</li>
          <li><b>Insurance:</b> follows the insurer&apos;s policy terms, including any free-look period.</li>
          <li><b>Forex:</b> once currency is loaded or delivered, the forex partner&apos;s buy-back terms apply.</li>
          <li><b>Flights and hotels:</b> follow the airline&apos;s fare rules and the hotel&apos;s policy, which we share with your options before you choose.</li>
        </ul>
      </section>
      <section>
        <h2>If we or a partner cancel</h2>
        <p>If your trip can&apos;t go ahead because of us or a partner, you can choose a comparable alternative or a refund of what you paid for the affected services.</p>
      </section>
      <section>
        <h2>How refunds are paid</h2>
        <p>Refunds go back to the account you paid from. We start refunds as soon as we confirm the cancellation and pass on partner refunds when we receive them; we&apos;ll tell you the expected timeline in writing.</p>
      </section>
    </LegalPage>
  );
}
