import { AlertTriangle, CheckCircle2, ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";

import { AdeliConnectionForm } from "@/components/adeli/connection-form";
import { GetKeyInstructions } from "@/components/onboarding/get-key-instructions";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAdeliKey, type KeyState } from "@/lib/actions";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Setup (FR-S.1, FR-S.5). Takes the Adeli API key (and, optionally, the Adeli
 * URL), checks it against Adeli, and shows the result or the exact problem.
 */
export default async function SetupPage() {
  const user = await requireUserPage();
  const [key, account] = await Promise.all([checkAdeliKey(), getConnectedAccount(user.id)]);
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
            Adeli Chat sends comments and DMs through Adeli, so it needs an API key from your Adeli account. Each person who signs in uses their own key, and only they can see it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <GetKeyInstructions />
          <AdeliConnectionForm hasKey={false} baseURL={key.baseURL} submitLabel="Connect to Adeli" />
        </CardContent>
      </Card>
    );
  }

  if (key.message || key.status !== "valid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-destructive" /> Adeli needs attention</CardTitle>
          <CardDescription>Fix the problem below. To use a different key, paste it here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProblemNote message={key.message ?? "Adeli didn't accept this key."} />
          <KeySummary prefix={key.prefix} profileName={key.profileName} />
          <AdeliConnectionForm hasKey={key.source === "settings"} baseURL={key.baseURL} submitLabel="Save and check" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4 text-primary" /> Connected to Adeli</CardTitle>
        <CardDescription>You can change the key any time in Settings.</CardDescription>
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
