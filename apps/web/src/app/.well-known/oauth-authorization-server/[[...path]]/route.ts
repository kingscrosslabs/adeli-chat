import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** RFC 8414 authorization server metadata, at the root and with the issuer path (`/api/auth`) appended. */
export const GET = (request: Request) => oauthProviderAuthServerMetadata(auth())(request);
