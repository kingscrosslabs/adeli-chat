import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { AlertTriangle, Eye, PencilLine, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Wordmark } from "@adeli-chat/ui/brand/wordmark";
import { Button } from "@adeli-chat/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@adeli-chat/ui/components/card";
import { Switch } from "@adeli-chat/ui/components/switch";
import { answerConsent } from "@/lib/actions";
import { authEnabled } from "@/lib/auth/config";
import { auth } from "@/lib/auth/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/**
 * Where our OAuth server asks the user to approve an app (Claude) that wants
 * to reach their automations through `/mcp`. The query is signed by Better
 * Auth; it's checked here before anything is shown.
 */
export default async function ConsentPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!authEnabled()) redirect("/automations");
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const query = await signedQuery(await searchParams);
  const client = query ? await loadClient(query.get("client_id")) : null;
  if (!query || !client) return <Shell><Problem message="This request expired or isn't valid. Go back to the app you were connecting and try again." /></Shell>;

  const scopes = (query.get("scope") ?? "").split(" ").filter(Boolean);
  const wantsWrite = scopes.includes(MCP_WRITE_SCOPE);
  const redirectHost = hostOf(query.get("redirect_uri"));
  const name = client.client_name || "An app";

  return (
    <Shell>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-link" /> Connect {name} to Adeli Chat</CardTitle>
          <CardDescription>
            {name} wants to reach the automations for {user.email}.{redirectHost ? <> You&apos;ll be sent back to <span className="font-medium text-foreground">{redirectHost}</span>.</> : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={answerConsent} className="space-y-5">
            <input type="hidden" name="oauth_query" value={query.toString()} />
            <input type="hidden" name="scope" value={scopes.join(" ")} />
            <ul className="space-y-3 text-sm">
              {scopes.includes(MCP_READ_SCOPE) || wantsWrite ? (
                <li className="flex gap-3"><Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>See your automations, their stats and your recent Instagram posts.</span></li>
              ) : null}
              {wantsWrite ? (
                <li className="flex gap-3">
                  <PencilLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <label className="flex flex-1 items-start justify-between gap-4">
                    <span>Create, change, go live with, pause and delete automations. Live automations reply and send DMs from your Instagram account.</span>
                    <Switch name="allow_write" defaultChecked aria-label="Allow changes" />
                  </label>
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-muted-foreground">You can disconnect it any time in Connect to AI Agent.</p>
            <div className="flex gap-2">
              <Button type="submit" name="decision" value="allow" className="flex-1">Allow</Button>
              <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">Deny</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

/** Only the parameters Better Auth signed, and only when the signature checks out. */
async function signedQuery(params: Params): Promise<URLSearchParams | null> {
  if (typeof params.sig !== "string") return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const { secret } = await auth().$context;
  return (await verifyOAuthQueryParams(query.toString(), secret)) ? query : null;
}

async function loadClient(clientId: string | null) {
  if (!clientId) return null;
  return auth().api.getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() }).catch(() => null);
}

function hostOf(url: string | null) {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Wordmark />
        {children}
      </div>
    </main>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <div className="flex w-full gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
