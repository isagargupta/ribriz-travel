import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VisaApply from "@/components/visa-service/VisaApply";
import { visaDestination } from "@/lib/visa-service";

export const metadata: Metadata = { title: "Apply for your visa", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ApplyPage({ params, searchParams }: { params: Promise<{ dest: string }>; searchParams: Promise<{ p?: string; n?: string; d?: string }> }) {
  const [{ dest }, sp] = await Promise.all([params, searchParams]);
  const d = await visaDestination(dest);
  if (!d) notFound();
  const p = d.products.find((x) => x.slug === sp.p && x.canApply) ?? d.products.find((x) => x.canApply);
  if (!p) notFound();
  const n = Math.max(1, Math.min(9, Number(sp.n) || 1));
  const date = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : "";
  return <VisaApply product={p} travellers={n} date={date} country={d.country} code={d.countryCode} />;
}
