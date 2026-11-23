import type { Metadata } from "next";
import { verifyUnsubscribe } from "@/lib/agents/optout";
import UnsubscribeButton from "./UnsubscribeButton";

export const metadata: Metadata = { title: "Email updates", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  const { e, s } = await searchParams;
  const email = verifyUnsubscribe(e ?? null, s ?? null);
  return (
    <div className="wrap narrow" style={{ padding: "56px 0 80px" }}>
      <div className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26 }}>Trip updates from Riya</h1>
        {email ? (
          <>
            <p>Riya emails <b>{email}</b> when something changes on your trip: price drops, holds ending, visa deadlines and missing documents.</p>
            <UnsubscribeButton e={e!} s={s!} />
            <p className="fine">Booking confirmations and replies from our team still reach you. Updates stay visible in your trip hub.</p>
          </>
        ) : (
          <p>This link isn&apos;t valid or has been changed. Use the link in your latest email from us, or reply to it and we&apos;ll sort it out.</p>
        )}
      </div>
    </div>
  );
}
