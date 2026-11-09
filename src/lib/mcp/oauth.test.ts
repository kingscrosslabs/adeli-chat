import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth/server";

import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

import { submitConsent } from "./consent";
import { handleMcpRequest } from "./handler";

/**
 * The OAuth path Claude's connectors take, end to end against our own auth
 * server: register, authorize (signed in), consent, exchange the code, then
 * call `/mcp` with the access token. Google sign-in itself is skipped by
 * creating the session directly.
 */

const ORIGIN = "http://localhost:3030";
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";
// RFC 7636 appendix B example pair.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubEnv("APP_URL", ORIGIN);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-oauth-flow-0123456789abcdef");
  // `requireMcpAuth` fetches our JWKS over HTTP; answer it in process.
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.startsWith(`${ORIGIN}/api/auth/`)) return auth().handler(request);
    return realFetch(input, init);
  });
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  await resetDatabase();
  await seedUser("user_1");
});

async function sessionCookie(userId: string) {
  const context = await auth().$context;
  const session = await context.internalAdapter.createSession(userId);
  const signed = encodeURIComponent(`${session.token}.${await makeSignature(session.token, context.secret)}`);
  return `${context.authCookies.sessionToken.name}=${signed}`;
}

async function registerClient() {
  const response = await auth().handler(new Request(`${ORIGIN}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  }));
  expect(response.status, await response.clone().text()).toBeLessThan(300);
  return (await response.json()).client_id as string;
}

/** Runs authorize, consent and the token exchange. Returns the access token. */
async function connectClaude({ allowWrite }: { allowWrite: boolean }) {
  const clientId = await registerClient();
  const cookie = await sessionCookie("user_1");
  const scope = "automations:read automations:write offline_access";

  const authorize = new URL(`${ORIGIN}/api/auth/oauth2/authorize`);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, scope, state: "xyz", code_challenge: CHALLENGE, code_challenge_method: "S256", resource: `${ORIGIN}/mcp` })) authorize.searchParams.set(key, value);
  const toConsent = await auth().handler(new Request(authorize, { headers: { cookie, accept: "text/html" }, redirect: "manual" }));
  const consentUrl = new URL(toConsent.headers.get("location") ?? "", ORIGIN);
  expect(consentUrl.pathname).toBe("/consent");

  const callback = new URL(await submitConsent({ cookie, oauthQuery: consentUrl.search.slice(1), requestedScope: scope, accept: true, allowWrite }));
  expect(`${callback.origin}${callback.pathname}`).toBe(REDIRECT_URI);
  const code = callback.searchParams.get("code");
  expect(code).toBeTruthy();

  const tokenResponse = await auth().handler(new Request(`${ORIGIN}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: code!, code_verifier: VERIFIER, redirect_uri: REDIRECT_URI, client_id: clientId, resource: `${ORIGIN}/mcp` }),
  }));
  const tokens = await tokenResponse.json();
  expect(tokenResponse.status, JSON.stringify(tokens)).toBe(200);
  expect(tokens.refresh_token).toBeTruthy();
  return tokens.access_token as string;
}

async function connect(token: string) {
  const client = new Client({ name: "claude-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
    fetch: (input, init) => handleMcpRequest(new Request(input, init)),
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  return client;
}

describe("OAuth for Claude connectors", () => {
  it("issues a token bound to /mcp that reaches the user's automations", async () => {
    const account = await seedAccount("user_1");
    const automation = await seedLiveAutomation(account.id);
    const client = await connect(await connectClaude({ allowWrite: true }));

    const listed = await client.callTool({ name: "list_automations", arguments: {} });
    expect(listed.isError).toBeFalsy();
    expect(JSON.parse((listed.content as Array<{ text: string }>)[0].text)[0].id).toBe(automation.id);

    const paused = await client.callTool({ name: "pause_automation", arguments: { id: automation.id } });
    expect(paused.isError).toBeFalsy();
  });

  it("is read only when the user turned off changes on the consent page", async () => {
    const account = await seedAccount("user_1");
    const automation = await seedLiveAutomation(account.id);
    const client = await connect(await connectClaude({ allowWrite: false }));

    expect((await client.callTool({ name: "get_automation", arguments: { id: automation.id } })).isError).toBeFalsy();
    const paused = await client.callTool({ name: "pause_automation", arguments: { id: automation.id } });
    expect(paused.isError).toBe(true);
  });

  it("sends the user back with access_denied when they deny", async () => {
    const clientId = await registerClient();
    const cookie = await sessionCookie("user_1");
    const authorize = new URL(`${ORIGIN}/api/auth/oauth2/authorize`);
    for (const [key, value] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, scope: "automations:read", state: "s", code_challenge: CHALLENGE, code_challenge_method: "S256" })) authorize.searchParams.set(key, value);
    const toConsent = await auth().handler(new Request(authorize, { headers: { cookie, accept: "text/html" }, redirect: "manual" }));
    const consentUrl = new URL(toConsent.headers.get("location") ?? "", ORIGIN);
    const callback = new URL(await submitConsent({ cookie, oauthQuery: consentUrl.search.slice(1), requestedScope: "automations:read", accept: false, allowWrite: false }));
    expect(callback.searchParams.get("error")).toBe("access_denied");
  });

  it("rejects a token that isn't ours", async () => {
    const response = await handleMcpRequest(new Request(`${ORIGIN}/mcp`, { method: "POST", headers: { authorization: "Bearer not.a.jwt", "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
    expect(response.status).toBe(401);
  });
});
