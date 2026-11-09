import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";

import { appUrl } from "@/lib/app-url";
import { db, schema } from "@/lib/db";

import { googleCredentials, signInRefusal } from "./config";

/**
 * Better Auth with Google as the only sign-in method. Who may sign in:
 * - `ALLOWED_EMAILS` set: only those addresses.
 * - Not set: the first Google account to sign in owns the install, and
 *   nobody else can create an account after that.
 */
function create() {
  const google = googleCredentials();
  return betterAuth({
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user: schema.authUser, session: schema.authSession, account: schema.authAccount, verification: schema.authVerification },
    }),
    socialProviders: google ? { google: { clientId: google.clientId, clientSecret: google.clientSecret, prompt: "select_account" } } : {},
    user: {
      async validateUserInfo({ user, source }) {
        const creatingUser = source.action === "create-user";
        const existingUsers = creatingUser ? (await db().select({ total: count() }).from(schema.authUser))[0].total : 0;
        const refusal = signInRefusal({ email: typeof user.email === "string" ? user.email : "", creatingUser, existingUsers });
        return refusal ? { error: "not_allowed", errorDescription: refusal } : undefined;
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof create>;

// One instance per process, created on first use (not at build time).
const globalForAuth = globalThis as unknown as { adeliChatAuth?: Auth };

export function auth(): Auth {
  globalForAuth.adeliChatAuth ??= create();
  return globalForAuth.adeliChatAuth;
}
