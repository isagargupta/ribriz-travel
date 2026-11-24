import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MemoryEditor from "@/components/you/MemoryEditor";
import { getOwner } from "@/lib/owner";
import { getProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "What Riya knows about you", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function YouPage() {
  const owner = await getOwner();
  if (owner.customerId) redirect("/me/profile"); // signed in: it lives in the traveller app
  const profile = await getProfile(owner);
  return (
    <div className="wrap you">
      <div className="page-head">
        <span className="kicker">Your travel profile</span>
        <h1>What Riya knows about you</h1>
        <p>Riya uses this to pick trips and plan the details without asking twice. It&apos;s only used for your trips. Change anything, or erase it all, whenever you like.</p>
        {!owner.customerId && <p className="fine">Saved in this browser. <Link href="/login?next=/you">Sign in</Link> to keep it across devices.</p>}
      </div>
      <MemoryEditor initial={profile} />
    </div>
  );
}
