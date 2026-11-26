"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpInstance = { open: () => void; on: (e: string, f: (r: { error?: { description?: string; metadata?: { order_id?: string } } }) => void) => void };
declare global { interface Window { Razorpay?: new (o: object) => RzpInstance } }

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok(); s.onerror = () => bad(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout for the amount the server says is due, then confirms with the server. */
export default function PayButton({ refCode, token, label, share = false, payerName, secondary = false }: { refCode: string; token: string | null; label: string; share?: boolean; payerName?: string; secondary?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "verifying" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    setState("busy"); setErr(null);
    try {
      const [o] = await Promise.all([
        fetch("/api/payments/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: refCode, t: token, ...(share ? { share: true, payerName } : {}) }) }).then((r) => r.json()),
        loadCheckout(),
      ]);
      if (!o.ok) throw new Error(o.error || "Couldn't start the payment.");
      const rzp = new window.Razorpay!({
        key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: "INR",
        name: "Ribriz Travel", description: o.description, image: "/icon.png",
        prefill: o.prefill, notes: { ref: refCode }, theme: { color: "#ff5a36" },
        handler: async (r: RzpResponse) => {
          setState("verifying");
          const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }).then((x) => x.json()).catch(() => ({ ok: false }));
          if (!v.ok) { setState("idle"); setErr(v.error || "We couldn't confirm the payment yet. If money left your account, it will show here within a few minutes."); return; }
          setState("done");
          setTimeout(() => router.refresh(), 1600);
        },
        modal: { ondismiss: () => setState((s) => (s === "busy" ? "idle" : s)) },
      });
      rzp.on("payment.failed", (r) => {
        if (r.error?.metadata?.order_id) fetch("/api/payments/failed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: r.error.metadata.order_id }) });
        setErr(r.error?.description ? `${r.error.description} Nothing was charged; you can try again.` : "The payment didn't go through. Nothing was charged; please try again.");
      });
      rzp.open();
    } catch (e) {
      setState("idle"); setErr((e as Error).message);
    }
  }

  if (state === "done") return <div className="pay-done" role="status"><span className="pay-tick">✓</span><b>Payment received</b><p>We&apos;ve emailed your receipt. Updating your booking…</p></div>;
  return (
    <div className="pay-btn-wrap">
      <button className={`btn ${secondary ? "" : "hot"} lg block pay-btn`} onClick={pay} disabled={state !== "idle"}>
        {state === "verifying" ? <><span className="spinner" /> Confirming your payment…</> : state === "busy" ? <><span className="spinner" /> Opening secure payment…</> : <>🔒 {label}</>}
      </button>
      {err && <p className="appr-err" role="alert">{err}</p>}
      <p className="fine center">UPI, cards, net banking and wallets · Secured by Razorpay</p>
    </div>
  );
}
