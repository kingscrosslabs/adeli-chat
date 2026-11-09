import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { appUrl } from "@/lib/app-url";
import { db, schema } from "@/lib/db";

import { googleCredentials, signInRefusal } from "./config";

/**
 * Better Auth with Google as the only sign-in method. Anyone with Google can
 * sign in and gets their own workspace, unless `ALLOWED_EMAILS` limits it.
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
      validateUserInfo({ user }) {
        const refusal = signInRefusal(typeof user.email === "string" ? user.email : "");
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
