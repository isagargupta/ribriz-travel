import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CodeLogin from "@/components/auth/CodeLogin";
import PasswordLogin from "@/components/admin/PasswordLogin";
import { adminEmails, isAdmin, passwordLoginEnabled } from "@/lib/auth";
import { requestAdminCode, verifyAdminCode } from "../actions";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  if (await isAdmin()) redirect("/admin");
  const codes = adminEmails().length > 0;
  const password = passwordLoginEnabled();

  return (
    <div className="auth-wrap" style={{ margin: "8vh auto", padding: "0 16px", display: "grid", gap: 16 }}>
      <img src="/img/logo.png" alt="Ribriz Travel" style={{ height: 48, justifySelf: "center" }} />
      <h1 style={{ fontSize: 24, textAlign: "center" }}>Admin sign in</h1>
      {codes && <CodeLogin request={requestAdminCode} verify={verifyAdminCode} next="/admin" intro={<p className="muted" style={{ margin: 0 }}>Team members get a sign-in code by email.</p>} />}
      {codes && password && <div className="or-line"><span>or</span></div>}
      {password && <PasswordLogin />}
      {!codes && !password && <div className="notice err">Admin sign-in isn&apos;t set up. Add ADMIN_EMAILS (and/or ADMIN_PASSWORD) to the environment settings.</div>}
      <a className="muted" href="/" style={{ fontSize: 13, textAlign: "center" }}>← Back to site</a>
    </div>
  );
}
