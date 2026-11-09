import { AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/actions";
import { authEnabled, googleCredentials } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_allowed: "This Google account isn't allowed to use this Adeli Chat.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Sent here by our OAuth server (an MCP client like Claude connecting): keep the signed query for after Google.
  const oauthQuery = signedOAuthQuery(params);
  if (!authEnabled() || (!oauthQuery && (await getCurrentUser()))) redirect("/automations");
  const error = typeof params.error === "string" ? params.error : undefined;
  const description = typeof params.error_description === "string" ? params.error_description : undefined;
  const problem = error ? description || ERRORS[error] || "Sign-in didn't work. Try again." : null;
  const configured = Boolean(googleCredentials());

  return (
    <main className="grid min-h-screen place-items-center bg-brand-fog/60 px-4 py-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Wordmark />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>
              {oauthQuery
                ? "Sign in to let an app like Claude manage your Adeli Chat automations. You'll choose what it can do next."
                : "Sign in to manage your own Comment to DM automations. Your Adeli key and automations are only visible to you."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {problem ? <Problem message={problem} /> : null}
            {configured ? (
              <form action={signInWithGoogle}>
                {oauthQuery ? <input type="hidden" name="oauth_query" value={oauthQuery} /> : null}
                <Button type="submit" size="lg" className="w-full"><GoogleIcon /> Continue with Google</Button>
              </form>
            ) : (
              <Problem message="Google sign-in isn't set up on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and BETTER_AUTH_SECRET, then redeploy." />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/** The query our OAuth server signed (it has `sig`), rebuilt in order, or null. */
function signedOAuthQuery(params: Record<string, string | string[] | undefined>): string | null {
  if (typeof params.sig !== "string") return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "error" || key === "error_description") continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  return query.toString();
}

function Problem({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 4 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.6-.07-1.05-.15-1.5Z" />
    </svg>
  );
}
