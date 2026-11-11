import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** OpenID Connect discovery, for clients that look here instead of RFC 8414. */
export const GET = (request: Request) => oauthProviderOpenIdConfigMetadata(auth())(request);
