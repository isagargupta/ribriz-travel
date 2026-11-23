import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CodeLogin from "@/components/auth/CodeLogin";
import { currentCustomer } from "@/lib/customer";
import { requestCustomerCode, verifyCustomerCode } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  if (await currentCustomer()) redirect(sp.next?.startsWith("/") ? sp.next : "/me");
  return (
    <div className="wrap narrow auth-wrap">
      <div className="page-head">
        <span className="kicker">Your account</span>
        <h1>Sign in to Ribriz</h1>
        <p>See all your price holds and bookings in one place, and book faster next time.</p>
      </div>
      <CodeLogin request={requestCustomerCode} verify={verifyCustomerCode} next={sp.next} defaultEmail={sp.email ?? ""} />
    </div>
  );
}
