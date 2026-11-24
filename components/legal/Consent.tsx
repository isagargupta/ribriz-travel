import Link from "next/link";

/** Short notice at every point where we collect personal data. */
export default function Consent({ action = "continuing", extra }: { action?: string; extra?: string }) {
  return (
    <p className="fine consent">
      By {action}, you agree to our <Link href="/legal/terms" target="_blank">Terms</Link> and <Link href="/legal/privacy" target="_blank">Privacy policy</Link>.{extra ? ` ${extra}` : ""}
    </p>
  );
}
