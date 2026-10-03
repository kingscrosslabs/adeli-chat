"use client";

import { AlertTriangle, Check, ExternalLink, AtSign, Loader2, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Guard } from "@/components/guard";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adeli, MOCK_NEW_ACCOUNT } from "@/lib/adeli/mock";
import type { AdeliAccount } from "@/lib/adeli/types";
import { actions, useDemoState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export default function ConnectPage() {
  return (
    <Guard require="key">
      <OnboardingLayout step="account">
        <ConnectCard />
      </OnboardingLayout>
    </Guard>
  );
}

type Flow =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; sessionId: string; processing: boolean }
  | { kind: "failed"; message: string };

function ConnectCard() {
  const router = useRouter();
  const state = useDemoState();
  const [accounts, setAccounts] = useState<AdeliAccount[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(state?.account?.accountId ?? null);
  const [flow, setFlow] = useState<Flow>({ kind: "idle" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadAccounts() {
    setLoadError(false);
    setAccounts(null);
    try {
      const result = await adeli.listInstagramAccounts();
      setAccounts(result);
      setSelected((current) => current ?? result.find((account) => account.connectionStatus === "connected")?.accountId ?? null);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    adeli.listInstagramAccounts().then(
      (result) => {
        if (cancelled) return;
        setAccounts(result);
        setSelected((current) => current ?? result.find((account) => account.connectionStatus === "connected")?.accountId ?? null);
      },
      () => { if (!cancelled) setLoadError(true); },
    );
    return () => {
      cancelled = true;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }

  async function startConnect(authMethod: "instagram_login" | "facebook_login") {
    setFlow({ kind: "starting" });
    try {
      const session = await adeli.startConnect(authMethod);
      // The real flow opens session.authUrl in a new tab here. The demo stays put.
      setFlow({ kind: "waiting", sessionId: session.id, processing: false });
      stopPolling();
      pollTimer.current = setInterval(async () => {
        const next = await adeli.getConnectSession(session.id);
        if (next.status === "processing") setFlow({ kind: "waiting", sessionId: session.id, processing: true });
        if (next.status === "connected") {
          stopPolling();
          setAccounts((current) => [...(current ?? []).filter((account) => account.accountId !== MOCK_NEW_ACCOUNT.accountId), MOCK_NEW_ACCOUNT]);
          setSelected(MOCK_NEW_ACCOUNT.accountId);
          setFlow({ kind: "idle" });
          toast.success(`Connected @${MOCK_NEW_ACCOUNT.displayIdentifier}`);
        }
        if (next.status === "failed" || next.status === "expired") {
          stopPolling();
          setFlow({ kind: "failed", message: next.error ?? "Instagram didn't finish connecting." });
        }
      }, 1000);
    } catch {
      setFlow({ kind: "failed", message: "We couldn't reach Adeli. Try again in a minute." });
    }
  }

  function cancel() {
    stopPolling();
    setFlow({ kind: "idle" });
  }

  function useAccount() {
    const account = accounts?.find((item) => item.accountId === selected);
    if (!account) return;
    actions.connectAccount(account);
    toast.success(`Using @${account.displayIdentifier}`);
    router.push("/automations");
  }

  const hasAccounts = Boolean(accounts?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><AtSign className="size-4 text-primary" /> Choose your Instagram account</CardTitle>
        <CardDescription>
          Pick an account you&apos;ve connected in Adeli, or connect a new one. It needs to be an Instagram Business or Creator account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            <span>We couldn&apos;t load your accounts from Adeli.</span>
            <Button size="sm" variant="outline" onClick={() => void loadAccounts()}><RefreshCw /> Retry</Button>
          </div>
        ) : accounts === null ? (
          <div className="space-y-2" aria-label="Loading accounts" role="status">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : hasAccounts ? (
          <div role="radiogroup" aria-label="Instagram accounts" className="space-y-2">
            {accounts.map((account) => (
              <AccountOption key={account.accountId} account={account} selected={selected === account.accountId} onSelect={() => setSelected(account.accountId)} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">No Instagram accounts are connected to this Adeli profile yet. Connect one below.</p>
        )}

        <ConnectNew flow={flow} primary={accounts !== null && !hasAccounts} onStart={startConnect} onCancel={cancel} onFail={() => { stopPolling(); setFlow({ kind: "failed", message: "Instagram says this is a personal account. Switch it to a Business or Creator account in the Instagram app, then try again." }); }} />

        {hasAccounts ? (
          <div className="flex justify-end border-t pt-4">
            <Button size="lg" onClick={useAccount} disabled={!selected || flow.kind === "waiting"}>Use this account</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountOption({ account, selected, onSelect }: { account: AdeliAccount; selected: boolean; onSelect: () => void }) {
  const needsReconnect = account.connectionStatus !== "connected";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={needsReconnect}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
        selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted",
      )}
    >
      <Avatar>
        {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
        <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">@{account.displayIdentifier}</span>
        <span className="block truncate text-xs text-muted-foreground">{account.displayName}</span>
      </span>
      {needsReconnect ? <Badge className="bg-warning-wash text-warning"><AlertTriangle /> Reconnect in Adeli</Badge> : null}
      <span className={cn("grid size-5 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {selected ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

function ConnectNew({ flow, primary, onStart, onCancel, onFail }: { flow: Flow; primary: boolean; onStart: (method: "instagram_login" | "facebook_login") => void; onCancel: () => void; onFail: () => void }) {
  if (flow.kind === "waiting") {
    return (
      <div className="space-y-3 rounded-lg border border-primary/30 bg-secondary/40 p-4" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <Loader2 className="size-4 animate-spin" />
          {flow.processing ? "Finishing up with Adeli…" : "Waiting for Instagram…"}
        </div>
        <p className="text-sm text-muted-foreground">
          {flow.processing ? "Almost there. Adeli is saving your connection." : "Finish logging in to Instagram in the tab we opened. This page updates by itself."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">Open Instagram login again <ExternalLink className="size-3" /></a>
          <button type="button" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onCancel}>Cancel</button>
          <button type="button" className="text-xs text-muted-foreground/80 underline-offset-4 hover:underline" onClick={onFail}>Demo: simulate a failure</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {flow.kind === "failed" ? (
        <div className="flex gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{flow.message}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant={primary ? "default" : "outline"} size="lg" onClick={() => onStart("instagram_login")} disabled={flow.kind === "starting"}>
          {flow.kind === "starting" ? <Loader2 className="animate-spin" /> : <Plus />}
          {flow.kind === "failed" ? "Try again" : "Connect a new account"}
        </Button>
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => onStart("facebook_login")} disabled={flow.kind === "starting"}>
          Use Facebook login instead
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Opens Instagram in a new tab. Adeli handles the login, so Adeli Chat never sees your password.</p>
    </div>
  );
}
