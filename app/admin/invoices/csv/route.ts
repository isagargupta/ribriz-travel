import { currentStaff, staffCan } from "@/lib/staff";
import { invoicesForMonth, toCsv } from "@/lib/invoices";

export const dynamic = "force-dynamic";

/** The month's invoices and credit notes as CSV, for GST returns. Admins only. */
export async function GET(req: Request) {
  const me = await currentStaff();
  if (!me || !staffCan(me, "money")) return new Response("Not found", { status: 404 });
  const m = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(m)) return new Response("Use ?month=YYYY-MM", { status: 400 });
  return new Response(toCsv(await invoicesForMonth(m)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ribriz-gst-${m}.csv"`, "Cache-Control": "private, no-store" },
  });
}
