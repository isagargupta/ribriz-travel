import { NextResponse, type NextRequest } from "next/server";
import { routeHost } from "./lib/host-rules";

/** Sends staff to workspace.ribriztravel.com and keeps the public site off it. */
export function proxy(req: NextRequest) {
  const d = routeHost(req.headers.get("host") ?? "", req.nextUrl.pathname, req.nextUrl.search, process.env.WORKSPACE_URL);
  if ("redirect" in d) return NextResponse.redirect(new URL(d.redirect, req.url), 308);
  if (!d.noindex) return NextResponse.next();
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
