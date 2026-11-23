import { NextResponse } from "next/server";
import { getVisaRules } from "@/lib/visa-data";

/** All destination rules for one passport. Cached at the edge for a day. */
export async function GET(_: Request, { params }: { params: Promise<{ passport: string }> }) {
  const passport = (await params).passport.toUpperCase();
  if (!/^[A-Z]{2}$/.test(passport)) return NextResponse.json({ error: "Use a two-letter country code." }, { status: 400 });
  const rules = await getVisaRules(passport);
  if (!rules.length) return NextResponse.json({ error: "No data for that passport." }, { status: 404 });
  return NextResponse.json(rules, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
