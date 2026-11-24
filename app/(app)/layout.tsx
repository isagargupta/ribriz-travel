import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { myDashboard } from "@/lib/dashboard";
import "./me/me.css";
import "./app.css";

export const dynamic = "force-dynamic";

/** The traveller app: its own shell, no site header or footer. Signed-in only. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await myDashboard();
  if (!data) redirect("/login?next=/me");
  const { me, d } = data;
  return (
    <AppShell
      me={{ name: me.name, email: me.email }}
      counts={{ trips: d.trips.length, needs: d.approvals.length, bookings: d.bookings.length, alerts: d.watching.length }}
    >
      {children}
    </AppShell>
  );
}
