import { AlertTriangle, CheckCircle2, ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";

import { GetKeyInstructions } from "@/components/onboarding/get-key-instructions";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAdeliKey, type KeyState } from "@/lib/actions";
import { getConnectedAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Setup (FR-S.1, FR-S.5). The key is env-only, so this page checks
 * `ADELI_API_KEY` against Adeli and shows the result or the exact problem.
 */
export default async function SetupPage() {
  const [key, account] = await Promise.all([checkAdeliKey(), getConnectedAccount()]);
  return (
    <OnboardingLayout step="key">
      <SetupCard keyState={key} next={account ? "/automations" : "/connect"} />
    </OnboardingLayout>
  );
}

function SetupCard({ keyState: key, next }: { keyState: KeyState; next: string }) {
  if (!key.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-primary" /> Add your Adeli API key</CardTitle>
          <CardDescription>
            Adeli Chat sends comments and DMs through Adeli, so it needs an API key from your Adeli account. Every install uses its own key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProblemNote message={key.message} />
          <GetKeyInstructions />
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            Put the key in <code className="font-mono">ADELI_API_KEY</code> in your server environment (<code className="font-mono">.env.local</code> when running locally), then restart Adeli Chat and reload this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (key.message || key.status !== "valid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-destructive" /> Adeli needs attention</CardTitle>
          <CardDescription>
            This install reads its key from <code className="font-mono">ADELI_API_KEY</code>. Fix the problem below, restart if you changed the key, then reload this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProblemNote message={key.message ?? "Adeli didn't accept this key."} />
          <KeySummary prefix={key.prefix} profileName={key.profileName} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4 text-primary" /> Connected to Adeli</CardTitle>
        <CardDescription>
          This install reads its key from <code className="font-mono">ADELI_API_KEY</code>. To change it, update the variable and restart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <KeySummary prefix={key.prefix} profileName={key.profileName} />
        <Link href={next} className={buttonVariants({ size: "lg" })}>Continue <ChevronRight data-icon="inline-end" /></Link>
      </CardContent>
    </Card>
  );
}

function ProblemNote({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function KeySummary({ prefix, profileName }: { prefix: string; profileName: string | null }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Key</dt>
      <dd className="font-mono text-[0.82rem]">{prefix}</dd>
      <dt className="text-muted-foreground">Adeli profile</dt>
      <dd className="font-medium">{profileName ?? "Not checked yet"}</dd>
    </dl>
  );
}
