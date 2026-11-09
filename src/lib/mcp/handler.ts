import "server-only";

import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, type AuthInfo, type McpHttpHandler } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";

import { appUrl } from "@/lib/app-url";
import { isAllowedEmail } from "@/lib/auth/config";
import { auth } from "@/lib/auth/server";
import { db, schema } from "@/lib/db";

import { MCP_READ_SCOPE, MCP_SCOPES, MCP_WRITE_SCOPE, mcpResourceUrl } from "./config";
import { createAdeliChatMcpServer, type McpPrincipal } from "./server";
import { looksLikeApiToken, userForToken } from "./tokens";

/**
 * `/mcp`: who is calling, then the MCP server for that user. Two ways in:
 *
 * - An API token (`adc_...`) from Settings, sent as `Authorization: Bearer`.
 *   Claude Code, Cursor and the manual JSON config use this.
 * - An OAuth access token from our own OAuth server (`src/lib/auth/server.ts`).
 *   Claude's custom connectors use this, since they can't send a fixed header.
 *
 * Without either, the response is a 401 that points at the protected resource
 * metadata, which is how an MCP client knows to start OAuth.
 */

let mcp: McpHttpHandler | undefined;

function mcpHandler(): McpHttpHandler {
  // Stateless: a fresh server per request, built for the user in `authInfo`.
  mcp ??= createMcpHandler((context) => createAdeliChatMcpServer(principalOf(context.authInfo)));
  return mcp;
}

function principalOf(authInfo: AuthInfo | undefined): McpPrincipal {
  const extra = authInfo?.extra as Partial<McpPrincipal> | undefined;
  if (!extra?.userId) throw new Error("MCP request reached the server without a verified user.");
  return { userId: extra.userId, canWrite: Boolean(extra.canWrite) };
}

function serve(request: Request, token: string, clientId: string, principal: McpPrincipal, scopes: string[]) {
  return mcpHandler().fetch(request, { authInfo: { token, clientId, scopes, resource: new URL(mcpResourceUrl()), extra: principal } });
}

/** `ALLOWED_EMAILS` can change after a token was issued, so it's checked on every request. */
async function stillAllowed(userId: string): Promise<boolean> {
  const [user] = await db().select({ email: schema.authUser.email }).from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  return Boolean(user && (userId === "local" || isAllowedEmail(user.email)));
}

export function protectedResourceMetadataUrl() {
  return `${appUrl()}/.well-known/oauth-protected-resource/mcp`;
}

function unauthorized(message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": `Bearer error="invalid_token", error_description="${message}", resource_metadata="${protectedResourceMetadataUrl()}"` } },
  );
}

function bearerOf(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

const viaOAuth = (request: Request) => requireMcpAuth(auth(), async (inner, claims) => {
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  if (!userId || !(await stillAllowed(userId))) return unauthorized("This account can't use Adeli Chat any more.");
  const scopes = typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];
  if (!scopes.includes(MCP_READ_SCOPE) && !scopes.includes(MCP_WRITE_SCOPE)) return unauthorized("This token doesn't allow access to automations.");
  const clientId = typeof claims.azp === "string" ? claims.azp : "oauth";
  return serve(inner, bearerOf(inner) ?? "", clientId, { userId, canWrite: scopes.includes(MCP_WRITE_SCOPE) }, scopes);
}, { resource: mcpResourceUrl(), challengeScopes: [...MCP_SCOPES] })(request);

export async function handleMcpRequest(request: Request): Promise<Response> {
  const bearer = bearerOf(request);
  if (bearer && looksLikeApiToken(bearer)) {
    const user = await userForToken(bearer);
    if (!user) return unauthorized("This API token isn't valid. It may have been revoked or expired.");
    if (!(await stillAllowed(user.userId))) return unauthorized("This account can't use Adeli Chat any more.");
    const scopes = user.readOnly ? [MCP_READ_SCOPE] : [...MCP_SCOPES];
    return serve(request, bearer, `api-token:${user.tokenId}`, { userId: user.userId, canWrite: !user.readOnly }, scopes);
  }
  return viaOAuth(request);
}
