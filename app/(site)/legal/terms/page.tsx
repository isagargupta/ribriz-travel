import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Terms of booking" };

export default function Terms() {
  return (
    <LegalPage current="/legal/terms" title="Terms of booking" intro={`These terms apply when you use ${COMPANY.brand} (ribriztravel.com, Riya and the traveller app) and when you hold or book a trip or service with us. Please read them before you book.`}>
      <section>
        <h2>1. Who we are</h2>
        <p>{COMPANY.brand} is a brand of {COMPANY.legalName} (&ldquo;Ribriz&rdquo;, &ldquo;we&rdquo;), a company registered in India. We arrange holidays, group tours, hotel stays and cruises, and help with visas, travel insurance, forex, flights and hotels. Some services are provided by partners (airlines, hotels, ground operators, insurers, forex providers); their terms also apply to the part they provide.</p>
      </section>
      <section>
        <h2>2. Prices</h2>
        <ul>
          <li>Prices on trip pages are per adult in Indian rupees before 5% GST, unless shown as a total. Totals we show include GST.</li>
          <li>Where flights are included, prices assume departure from the city you choose; other cities may cost more and we show the difference.</li>
          <li>Children pay a share of the adult price by age, as shown when you add them.</li>
          <li>Prices can change until your booking is confirmed. The price in your written booking confirmation is the price you pay.</li>
        </ul>
      </section>
      <section>
        <h2>3. Free price holds</h2>
        <p>A price hold keeps a price for 48 hours. It is free, it is not a booking, and you don&apos;t pay anything to hold. If the hold ends, the trip is offered again at the price on that day.</p>
      </section>
      <section>
        <h2>4. Booking and payment</h2>
        <ul>
          <li>Your booking is confirmed when we receive your deposit and send you a written confirmation by email.</li>
          <li>The deposit is 10% of the total (minimum ₹5,000). The balance is due 30 days before departure. If you book within 30 days of departure, the full amount is due at booking.</li>
          <li>We send payment details with your confirmation. We will never ask for card details, passwords or one-time codes by email, chat or WhatsApp.</li>
          <li>If the balance isn&apos;t paid by the due date, we may treat the booking as cancelled by you (see <Link href="/legal/cancellation">Cancellations &amp; refunds</Link>).</li>
        </ul>
      </section>
      <section>
        <h2>5. Your details and documents</h2>
        <p>Please give names exactly as on passports and keep your contact details current. You are responsible for valid passports (normally at least 6 months beyond your return), visas, health requirements and travel documents for every traveller.</p>
      </section>
      <section>
        <h2>6. Visas</h2>
        <p>Our visa information comes from public data and can lag behind official changes; always confirm on the official government website. When we help with an application, the decision belongs to the embassy or authority, processing times are estimates, and government and service fees are generally not refundable once an application is submitted. We cannot guarantee a visa.</p>
      </section>
      <section>
        <h2>7. Riya, our AI travel agent</h2>
        <p>Riya uses AI to search, compare and prepare things for you. Prices, dates and availability come from our live data, but AI can make mistakes. Riya never books, pays or submits anything without your tap on an approval card, and what&apos;s in your written confirmation is what counts.</p>
      </section>
      <section>
        <h2>8. Changes by us or our partners</h2>
        <p>Sometimes partners change flight times, hotels or itineraries. If a change is significant, we&apos;ll tell you as soon as we can and offer a comparable alternative or, where you choose not to accept it, a refund of what you paid for the affected services, as described in our cancellation policy.</p>
      </section>
      <section>
        <h2>9. Events outside our control</h2>
        <p>We aren&apos;t responsible for delays or failures caused by events outside our reasonable control, such as natural disasters, epidemics, war, government action, strikes or airline failures. We will help you with alternatives and pass on any refunds we receive from partners.</p>
      </section>
      <section>
        <h2>10. Our responsibility</h2>
        <p>We take care in arranging your trip. To the extent the law allows, our responsibility is limited to the amount you paid us for the affected booking, and we aren&apos;t liable for indirect losses. Nothing in these terms limits rights you have under Indian consumer law.</p>
      </section>
      <section>
        <h2>11. Complaints</h2>
        <p>If something goes wrong, email us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with your booking reference. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>
      </section>
      <section>
        <h2>12. Law and courts</h2>
        <p>These terms are governed by the laws of India. Courts in Bengaluru, Karnataka have jurisdiction, without affecting your right to approach consumer forums.</p>
      </section>
    </LegalPage>
  );
}
