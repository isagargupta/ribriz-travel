import "server-only";

/**
 * Minimal Razorpay REST client (orders, payments, capture, refunds).
 * Keys: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (RAZORPAY_LIVE_API_KEY /
 * RAZORPAY_LIVE_KEY_SECRET are accepted too). The secret never reaches the browser.
 */
export const rzpKeyId = () => process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_API_KEY || "";
export const rzpSecret = () => process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET || "";
export const rzpWebhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET || "";
export const rzpConfigured = () => !!(rzpKeyId() && rzpSecret());
export const rzpLive = () => rzpKeyId().startsWith("rzp_live_");

export class RazorpayError extends Error {}

async function call<T>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
  if (!rzpConfigured()) throw new RazorpayError("Payments aren't set up yet.");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${rzpKeyId()}:${rzpSecret()}`).toString("base64")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("razorpay", method, path, res.status, j.error?.description);
    throw new RazorpayError(j.error?.description || `Payment service error (${res.status})`);
  }
  return j;
}

export interface RzpOrder { id: string; amount: number; currency: string; status: string }
export interface RzpPayment { id: string; order_id: string; amount: number; currency: string; status: "created" | "authorized" | "captured" | "refunded" | "failed"; method?: string; amount_refunded?: number }
export interface RzpRefund { id: string; amount: number; status: string }

export const createOrder = (rupees: number, receipt: string, notes: Record<string, string>) =>
  call<RzpOrder>("POST", "/orders", { amount: rupees * 100, currency: "INR", receipt: receipt.slice(0, 40), notes });
export const fetchPayment = (id: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(id)}`);
export const capturePayment = (id: string, paise: number) => call<RzpPayment>("POST", `/payments/${encodeURIComponent(id)}/capture`, { amount: paise, currency: "INR" });
export const refundPayment = (id: string, rupees: number, notes: Record<string, string>) =>
  call<RzpRefund>("POST", `/payments/${encodeURIComponent(id)}/refund`, { amount: rupees * 100, notes });
