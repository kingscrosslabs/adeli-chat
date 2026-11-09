import "server-only";

import { appUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth/server";

import { MCP_WRITE_SCOPE } from "./config";

/**
 * Sends the consent page's answer to Better Auth's `/oauth2/consent` and
 * returns where the browser goes next (the client's redirect URI with a code,
 * or with `access_denied`). It goes through the auth handler as a real request
 * because the endpoint resumes the authorize step, which needs one.
 * Without `allowWrite`, the write scope is dropped: a read-only connection.
 */
export async function submitConsent(input: { cookie: string; oauthQuery: string; requestedScope: string; accept: boolean; allowWrite: boolean }): Promise<string> {
  const scope = input.requestedScope.split(" ").filter((item) => item && (input.allowWrite || item !== MCP_WRITE_SCOPE)).join(" ");
  const response = await auth().handler(new Request(`${appUrl()}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", cookie: input.cookie, origin: appUrl() },
    body: JSON.stringify({ accept: input.accept, scope, oauth_query: input.oauthQuery }),
  }));
  const result = (await response.json().catch(() => null)) as { url?: string; error_description?: string; message?: string } | null;
  if (!response.ok || !result?.url) throw new Error(result?.error_description || result?.message || "This request expired. Go back to the app you were connecting and try again.");
  return new URL(result.url, appUrl()).toString();
}
