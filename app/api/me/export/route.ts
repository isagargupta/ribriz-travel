import { NextResponse } from "next/server";
import { exportData } from "@/lib/account";
import { currentCustomer } from "@/lib/customer";
import { fail } from "@/lib/http";
import { getOwner } from "@/lib/owner";

/** Download everything we hold about the signed-in traveller, as JSON. */
export async function GET() {
  const me = await currentCustomer();
  if (!me) return fail("Please sign in.", 401);
  const data = await exportData(me, await getOwner());
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="ribriz-my-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "private, no-store" },
  });
}
