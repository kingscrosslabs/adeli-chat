import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { authEnabled } from "@/lib/auth/config";

/**
 * Optimistic sign-in redirect: pages need a session cookie when login is on.
 * The cookie is only a hint; pages, Server Actions and API routes check the
 * session for real (`src/lib/auth/session.ts`). Pages that need an Instagram
 * account send you to `/connect` themselves. A one-time connect link
 * (`/connect/start/<code>`) is how a signed-out browser gets a session, so it
 * goes through.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/sign-in" || pathname.startsWith("/connect/start/") || !authEnabled()) return NextResponse.next();
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes, `/mcp` and OAuth discovery answer errors themselves, static files need no session, `/ingest` is PostHog,
  // and `/robots.txt` must reach crawlers instead of redirecting to sign-in.
  matcher: ["/((?!api/|mcp(?:/|$)|\\.well-known/|_next/|ingest/|brand/|icon.png|apple-icon.png|favicon.ico|robots\\.txt$).*)"],
};
