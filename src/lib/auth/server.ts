import "server-only";

import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";

import { appUrl } from "@/lib/app-url";
import { db, schema } from "@/lib/db";
import { MCP_SCOPES, mcpResourceUrl } from "@/lib/mcp/config";

import { googleCredentials, signInRefusal } from "./config";

/**
 * Better Auth with Google as the only sign-in method. Anyone with Google can
 * sign in and gets their own workspace, unless `ALLOWED_EMAILS` limits it.
 *
 * It is also the OAuth 2.1 server for the MCP endpoint (`/mcp`), which is what
 * Claude's custom connectors use: `mcp()` issues access tokens bound to
 * `/mcp`, `jwt()` signs them, and `cimd()` lets clients identify themselves
 * with a metadata URL. Older clients that still register dynamically (DCR)
 * are allowed too, limited to the MCP scopes. See `src/lib/mcp/`.
 */
function create() {
  const google = googleCredentials();
  return betterAuth({
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.authUser,
        session: schema.authSession,
        account: schema.authAccount,
        verification: schema.authVerification,
        jwks: schema.authJwks,
        oauthClient: schema.oauthClient,
        oauthAccessToken: schema.oauthAccessToken,
        oauthRefreshToken: schema.oauthRefreshToken,
        oauthConsent: schema.oauthConsent,
        oauthClientAssertion: schema.oauthClientAssertion,
        oauthResource: schema.oauthResource,
        oauthClientResource: schema.oauthClientResource,
      },
    }),
    socialProviders: google ? { google: { clientId: google.clientId, clientSecret: google.clientSecret, prompt: "select_account" } } : {},
    user: {
      validateUserInfo({ user }) {
        const refusal = signInRefusal(typeof user.email === "string" ? user.email : "");
        return refusal ? { error: "not_allowed", errorDescription: refusal } : undefined;
      },
    },
    // The JWT plugin's own session-token route isn't needed, and its tokens share the access tokens' signing key.
    disabledPaths: ["/token"],
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: "/sign-in",
        consentPage: "/consent",
        resource: mcpResourceUrl(),
        scopes: ["openid", "profile", "email", "offline_access", ...MCP_SCOPES],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultApplicationType: "infer",
        clientRegistrationDefaultScopes: ["openid", "profile", "email", "offline_access", ...MCP_SCOPES],
        refreshTokenReuseInterval: 0,
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof create>;

// One instance per process, created on first use (not at build time).
const globalForAuth = globalThis as unknown as { adeliChatAuth?: Auth };

export function auth(): Auth {
  globalForAuth.adeliChatAuth ??= create();
  return globalForAuth.adeliChatAuth;
}
