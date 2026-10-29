import { NextResponse, type NextRequest } from "next/server";

import { getAdeliConfig } from "@/lib/adeli/key";
import { hasValidSession } from "@/lib/auth/session";

/**
 * Optimistic onboarding redirects (PRD FR-0.1, FR-S.1): log in, then a
 * configured Adeli key. The Instagram account check needs the database, so the
 * automations pages do it themselves (`requireAccount`).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (!hasValidSession(request)) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/setup" || pathname.startsWith("/settings")) return NextResponse.next();
  try {
    getAdeliConfig();
  } catch {
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes answer 401 themselves, and static files need no session.
  matcher: ["/((?!api/|_next/|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
