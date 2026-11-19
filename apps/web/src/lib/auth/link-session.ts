import "server-only";

import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

import { isAllowedEmail } from "./config";
import { auth } from "./server";

/**
 * Signs `userId` in from a one-time connect link (`src/lib/connect-links.ts`):
 * a new Better Auth session and the `Set-Cookie` header for it, signed the
 * way Better Auth signs its own session cookie. Null when the user is gone or
 * `ALLOWED_EMAILS` no longer lets them in.
 */
export async function sessionCookieFor(userId: string, request: Request): Promise<string | null> {
  const [user] = await db().select({ email: schema.authUser.email }).from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  if (!user || !isAllowedEmail(user.email)) return null;
  const context = await auth().$context;
  const session = await context.internalAdapter.createSession(userId, false, {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
    userAgent: request.headers.get("user-agent") ?? "",
  });
  const cookie = context.authCookies.sessionToken;
  const value = encodeURIComponent(`${session.token}.${await makeSignature(session.token, context.secret)}`);
  const { attributes } = cookie;
  const parts = [`${cookie.name}=${value}`, `Max-Age=${context.sessionConfig.expiresIn}`, `Path=${attributes.path ?? "/"}`];
  if (attributes.domain) parts.push(`Domain=${attributes.domain}`);
  if (attributes.httpOnly) parts.push("HttpOnly");
  if (attributes.secure) parts.push("Secure");
  if (attributes.sameSite) parts.push(`SameSite=${attributes.sameSite.charAt(0).toUpperCase()}${attributes.sameSite.slice(1)}`);
  return parts.join("; ");
}
