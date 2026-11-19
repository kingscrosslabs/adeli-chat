import { AlertTriangle, ServerCog } from "lucide-react";

import { ConnectCard } from "@/components/onboarding/connect-card";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { SignedInAs } from "@/components/onboarding/signed-in-as";
import { Card, CardDescription, CardHeader, CardTitle } from "@adeli-chat/ui/components/card";
import { findAdeliConfig } from "@/lib/adeli/key";
import { ensureUserProfile } from "@/lib/adeli/profile";
import { AdeliError } from "@/lib/adeli/types";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Onboarding (PRD §4): connect Instagram to the user's own Adeli profile.
 * The profile is made at sign-up; this makes it if that didn't happen.
 * `?via=mcp` (an agent's link) ends on "go back to your agent", and
 * `&start=instagram|facebook` starts that login on load.
 */
export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ via?: string; start?: string }> }) {
  const user = await requireUserPage();
  // From an agent's one-time link (`/connect/start/<code>`): finish here, then go back to the agent.
  const { via, start } = await searchParams;
  const agent = via === "mcp";
  const autoStart = start === "instagram" ? "instagram_login" : start === "facebook" ? "facebook_login" : null;
  const signedIn = authEnabled() ? <SignedInAs user={user} /> : null;
  if (!findAdeliConfig()) {
    return (
      <OnboardingLayout step="account" user={user}>
        <Problem icon="server" title="This server isn't connected to Adeli yet">
          LedaChat needs an Adeli API key in the <code className="font-mono text-[0.82rem]">ADELI_API_KEY</code> environment variable. Whoever runs this install can follow &quot;Get your Adeli API key&quot; in the README, then restart it.
        </Problem>
        {signedIn}
      </OnboardingLayout>
    );
  }

  const [account, problem] = await Promise.all([
    getConnectedAccount(user.id),
    ensureUserProfile(user.id, user).then(() => null, (error: unknown) => (error instanceof AdeliError ? error.message : "We couldn't reach Adeli. Try again in a minute.")),
  ]);
  return (
    <OnboardingLayout step="account" user={user}>
      {problem ? (
        <Problem icon="alert" title="We couldn't set up your Adeli profile">{problem} Refresh this page to try again.</Problem>
      ) : (
        <ConnectCard currentAccountId={account?.accountId ?? null} agent={agent} autoStart={autoStart} />
      )}
      {signedIn}
    </OnboardingLayout>
  );
}

function Problem({ icon, title, children }: { icon: "server" | "alert"; title: string; children: React.ReactNode }) {
  const Icon = icon === "server" ? ServerCog : AlertTriangle;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-destructive" /> {title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}
