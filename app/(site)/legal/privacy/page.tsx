import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage current="/legal/privacy" title="Privacy policy" intro={`This policy explains what personal data ${COMPANY.legalName} collects, why, who we share it with, how long we keep it and the rights you have under India's Digital Personal Data Protection Act, 2023. We are the Data Fiduciary for your data.`}>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Contact details:</b> name, email and mobile number when you hold a price, send a request, sign in or set an alert.</li>
          <li><b>Trip details:</b> destinations, dates, number of travellers, children&apos;s ages, departure city, passport country and the trips you hold or book.</li>
          <li><b>Travel documents you upload</b> for a visa (for example passport pages, photos, bank statements). From a passport we keep only the holder&apos;s name and expiry date to check validity; we don&apos;t store passport numbers in our database.</li>
          <li><b>What Riya remembers:</b> travel preferences you share (for example &ldquo;vegetarian&rdquo; or &ldquo;no long flights&rdquo;) and short notes. You can see, edit and erase them at any time.</li>
          <li><b>Conversations with Riya</b> are processed to answer you. The chat itself stays in your browser tab; we keep the results of actions (trip plans, requests, approvals) on your account.</li>
          <li><b>Reviews</b> you write, with the name you choose to show.</li>
          <li><b>Technical data:</b> essential cookies and basic request data (such as IP address) for security and to stop abuse. We don&apos;t use advertising or tracking cookies.</li>
          <li><b>WhatsApp:</b> only if you turn on WhatsApp updates in your profile, we send your number and short trip updates (payments, bookings, options to choose, urgent alerts) through Meta&apos;s WhatsApp Business service. Turn it off any time.</li>
          <li><b>Anonymous usage counts:</b> which pages and trips are viewed, and how far people get in booking, so we can improve the site. These use a random number kept only in your open browser tab (no cookie), never your name, email or IP address, and are deleted after 180 days.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To quote, hold and book trips and services you ask for, and to contact you about them.</li>
          <li>To help with visas: checking your documents and preparing applications you approve.</li>
          <li>To send trip updates (price drops you asked us to watch, holds ending, visa deadlines, pre-trip checklists). You can turn these off with the link in any update email.</li>
          <li>To personalise suggestions on the site and in Riya.</li>
          <li>To keep the service secure, meet legal and tax duties, and handle complaints.</li>
        </ul>
        <p>We process your data with your consent, which you give when you submit a form, upload a document or use Riya, and where the law otherwise allows. You can withdraw consent at any time; we&apos;ll stop, though we may keep what the law requires.</p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li><b>Travel partners</b> who provide what you book or request (airlines, hotels, ground operators, insurers, forex providers), and embassies or visa authorities when you approve an application.</li>
          <li><b>Service providers</b> who run parts of our service for us under contract: Vercel (website hosting), Supabase (database and private document storage), Anthropic (the AI behind Riya and our document checks; under its commercial terms it may not train its models on our data), Resend (email delivery) and Cloudflare (domain services).</li>
          <li>Authorities, where the law requires it.</li>
        </ul>
        <p>We don&apos;t sell your data or share it for advertising.</p>
      </section>
      <section>
        <h2>Where it is stored</h2>
        <p>Our database and document storage are on servers in the European Union (Ireland). Some service providers may process data in other countries, including the United States, with safeguards in their contracts. Transfers follow Indian law.</p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Visa documents are deleted automatically 30 days after your return date (or 180 days after upload if no trip date is set), or sooner if you delete them.</li>
          <li>Sign-in codes are deleted after 7 days.</li>
          <li>What Riya remembers stays until you erase it or delete your account.</li>
          <li>Booking and payment records are kept as long as tax and company law requires (generally up to 8 years).</li>
        </ul>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>You can ask to access, correct or erase your data, withdraw consent, nominate someone to act for you, and have grievances addressed. Signed-in travellers can download their data and delete their account in <Link href="/me/profile">Profile &amp; memory</Link>. Or email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. If you aren&apos;t satisfied with our response, you can complain to the Data Protection Board of India.</p>
      </section>
      <section>
        <h2>Children</h2>
        <p>We collect children&apos;s details only from a parent or guardian, to book travel for them.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Data travels encrypted. Documents are kept in private storage and opened only through links that expire after two minutes. Access is limited to people who need it to serve you.</p>
      </section>
      <section>
        <h2>Grievance officer</h2>
        <p>For privacy questions and complaints, write to our Grievance Officer at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, {COMPANY.legalName}, at the address below. We acknowledge within 48 hours and resolve within one month.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If we change this policy in a meaningful way, we&apos;ll update the date above and tell signed-in travellers by email.</p>
      </section>
    </LegalPage>
  );
}
