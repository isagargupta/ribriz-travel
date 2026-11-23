"use client";
import { useRouter } from "next/navigation";
import ApprovalCard, { type ApprovalCardData } from "../assistant/ApprovalCard";
import { askRiya } from "../assistant/Assistant";

/** Pending approvals on the hub; the page refreshes once one is decided. */
export function HubApprovals({ cards }: { cards: ApprovalCardData[] }) {
  const router = useRouter();
  return <div className="hub-appr">{cards.map((c) => <ApprovalCard key={c.id} card={c} onDecided={() => setTimeout(() => router.refresh(), 900)} />)}</div>;
}

export function AskAboutMission({ id, title, label = "Ask Riya to continue" }: { id: string; title: string; label?: string }) {
  return <button className="btn hot" onClick={() => askRiya(`Let's continue my trip "${title}" (mission ${id}). What's next?`)}>{label}</button>;
}

export function StartMission() {
  return <button className="btn hot lg" onClick={() => askRiya("I want to plan a trip. Help me find the best option and handle everything.")}>Plan a trip with Riya</button>;
}
