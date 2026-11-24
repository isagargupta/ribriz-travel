import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MissionDetail from "@/components/hub/MissionDetail";
import { getOwner } from "@/lib/owner";

export const metadata: Metadata = { title: "Trip hub", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // signed-in travellers see their trips inside their app
  if ((await getOwner()).customerId) redirect(`/me/trips/${id}`);
  return <MissionDetail id={id} backHref="/hub" />;
}
