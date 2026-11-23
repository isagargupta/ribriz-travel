import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer";

export const dynamic = "force-dynamic";

/** Who is signed in, for client components on otherwise static pages. */
export async function GET() {
  const me = await currentCustomer();
  return NextResponse.json(me ? { email: me.email, name: me.name, phone: me.phone } : null, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
