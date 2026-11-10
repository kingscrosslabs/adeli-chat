import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { authEnabled } from "@/lib/auth/config";

/**
 * Optimistic sign-in redirect: pages need a session cookie when login is on.
 * The cookie is only a hint; pages, Server Actions and API routes check the
 * session for real (`src/lib/auth/session.ts`). Pages that need an Instagram
 * account send you to `/connect` themselves.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/sign-in" || !authEnabled()) return NextResponse.next();
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes, `/mcp` and OAuth discovery answer errors themselves, and static files need no session.
  matcher: ["/((?!api/|mcp(?:/|$)|\\.well-known/|_next/|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
