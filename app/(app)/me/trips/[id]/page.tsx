import type { Metadata } from "next";
import MissionDetail from "@/components/hub/MissionDetail";

export const metadata: Metadata = { title: "Trip", robots: { index: false } };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MissionDetail id={id} backHref="/me/trips" backLabel="← My trips" />;
}
