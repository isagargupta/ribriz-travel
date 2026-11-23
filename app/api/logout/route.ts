import { NextResponse } from "next/server";
import { endCustomerSession } from "@/lib/customer";

/** Signs the customer out and loads the home page fresh. */
export async function POST(req: Request) {
  await endCustomerSession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
