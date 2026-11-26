import "server-only";
import { prisma } from "./db";
import { waParam } from "./whatsapp-rules";

/**
 * WhatsApp updates through Meta's WhatsApp Cloud API, for travellers who opted in.
 * Business-initiated messages must use an approved template. Create one in
 * WhatsApp Manager (category Utility), named WHATSAPP_TEMPLATE (default
 * "trip_update"), language en, with this body:
 *
 *   Hi {{1}}, {{2}} Details: {{3}}
 *
 * Then set WHATSAPP_TOKEN (a permanent system-user token) and WHATSAPP_PHONE_ID.
 * Until then nothing is sent.
 */
export const whatsappEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) && process.env.E2E !== "1";

export async function sendWhatsApp(to: string, firstName: string, text: string, url: string): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappEnabled()) return { ok: false, error: "WhatsApp isn't set up" };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "trip_update", language: { code: process.env.WHATSAPP_LANG || "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: waParam(firstName, 40) || "there" }, { type: "text", text: waParam(text) }, { type: "text", text: waParam(url, 300) }] }],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Sends an important update to a traveller who turned WhatsApp on. Never throws. */
export async function whatsappToCustomer(customerId: string, msg: { title: string; body: string; url?: string | null }) {
  if (!whatsappEnabled()) return false;
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, whatsappNumber: true, whatsappOptInAt: true } }).catch(() => null);
  if (!c?.whatsappNumber || !c.whatsappOptInAt) return false;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
  const r = await sendWhatsApp(c.whatsappNumber, c.name?.split(" ")[0] ?? "", `${msg.title}. ${msg.body}`, site + (msg.url ?? "/me"));
  if (!r.ok) console.error("whatsapp failed", r.error);
  return r.ok;
}
