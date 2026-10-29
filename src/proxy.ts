import { NextResponse, type NextRequest } from "next/server";

import { getAdeliConfig } from "@/lib/adeli/key";

/**
 * Optimistic onboarding redirect (PRD FR-S.1): pages need a configured Adeli
 * key. The Instagram account check needs the database, so the automations
 * pages do it themselves (`requireAccount`).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/setup" || pathname.startsWith("/settings")) return NextResponse.next();
  try {
    getAdeliConfig();
  } catch {
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes answer errors themselves, and static files need no key.
  matcher: ["/((?!api/|_next/|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
