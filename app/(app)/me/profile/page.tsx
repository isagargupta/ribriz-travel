import type { Metadata } from "next";
import ProfileForm from "@/components/auth/ProfileForm";
import MemoryEditor from "@/components/you/MemoryEditor";
import DataRights from "@/components/me/DataRights";
import { myDashboard } from "@/lib/dashboard";
import { getProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Profile & memory", robots: { index: false } };

export default async function Profile() {
  const { me, owner } = (await myDashboard())!;
  const profile = await getProfile(owner);
  return (
    <div className="wrap you">
      <div className="app-page-head"><div><h1>Profile & memory</h1><p>Your details for bookings, and everything Riya has learned about how you like to travel.</p></div></div>
      <section className="panel" style={{ maxWidth: 860, marginBottom: 18 }}>
        <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>Your details</h2>
        <p className="muted" style={{ marginTop: 0 }}>Signed in as <b>{me.email}</b>. Used to fill in your bookings.</p>
        <ProfileForm name={me.name ?? ""} phone={me.phone ?? ""} />
      </section>
      <MemoryEditor initial={profile} />
      <DataRights />
    </div>
  );
}
