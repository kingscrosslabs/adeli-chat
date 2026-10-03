"use client";

import { ChevronRight, KeyRound, ServerCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Guard } from "@/components/guard";
import { AdeliKeyForm } from "@/components/onboarding/adeli-key-form";
import { GetKeyInstructions } from "@/components/onboarding/get-key-instructions";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MOCK_PROFILE } from "@/lib/adeli/mock";
import { actions, readDemoState, useDemoState } from "@/lib/demo/store";

export default function SetupPage() {
  return (
    <Guard require="session">
      <OnboardingLayout step="key">
        <SetupCard />
      </OnboardingLayout>
    </Guard>
  );
}

function SetupCard() {
  const state = useDemoState();
  const router = useRouter();
  const key = state?.adeliKey;
  // Only offer "keep current key" if one existed when the page opened, so it doesn't flash in after saving.
  const [hadKey] = useState(() => Boolean(readDemoState().adeliKey));
  const goNext = () => router.push(readDemoState().account ? "/automations" : "/connect");

  if (key?.source === "env") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ServerCog className="size-4 text-primary" /> Adeli key managed by your server</CardTitle>
          <CardDescription>
            This install reads its key from <code className="font-mono">ADELI_API_KEY</code>, so there&apos;s nothing to paste here. To change it, update the environment variable and restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeySummary prefix={key.prefix} profileName={key.profileName} />
          <Link href={state?.account ? "/automations" : "/connect"} className={buttonVariants({ size: "lg" })}>Continue <ChevronRight data-icon="inline-end" /></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-primary" /> Connect your Adeli account</CardTitle>
        <CardDescription>
          Adeli Chat sends comments and DMs through Adeli, so it needs an API key from your Adeli account. Every install uses its own key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {key && hadKey ? (
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <p className="text-sm">You already have a key saved. Paste a new one below to replace it.</p>
            <KeySummary prefix={key.prefix} profileName={key.profileName} />
            <Link href={state?.account ? "/automations" : "/connect"} className={buttonVariants({ variant: "outline" })}>Keep current key and continue</Link>
          </div>
        ) : null}
        <GetKeyInstructions />
        <Separator />
        <AdeliKeyForm onSaved={goNext} />
        <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Just exploring?</p>
          <p className="mt-0.5">This is a demo build, so you can skip the key and use sample data.</p>
          <button
            type="button"
            className="mt-2 font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              actions.saveKey({ prefix: "rk_live_DemoK…", profileId: MOCK_PROFILE.id, profileName: MOCK_PROFILE.name, source: "ui" });
              goNext();
            }}
          >
            Skip, use demo data
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function KeySummary({ prefix, profileName }: { prefix: string; profileName: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Key</dt>
      <dd className="font-mono text-[0.82rem]">{prefix}</dd>
      <dt className="text-muted-foreground">Adeli profile</dt>
      <dd className="font-medium">{profileName}</dd>
    </dl>
  );
}
