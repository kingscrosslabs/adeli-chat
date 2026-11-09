import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/**
 * RFC 9728 protected resource metadata for `/mcp`, at the root and at
 * `/.well-known/oauth-protected-resource/mcp`. `@better-auth/mcp` builds it;
 * this route only reaches it, since Better Auth itself lives under `/api/auth`.
 */
export const GET = (request: Request) => auth().handler(request);
