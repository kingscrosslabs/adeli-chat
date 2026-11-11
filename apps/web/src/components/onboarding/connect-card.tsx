"use client";

import { AlertTriangle, Check, ExternalLink, AtSign, Loader2, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@adeli-chat/ui/components/avatar";
import { Badge } from "@adeli-chat/ui/components/badge";
import { Button } from "@adeli-chat/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@adeli-chat/ui/components/card";
import { Skeleton } from "@adeli-chat/ui/components/skeleton";
import { adeli } from "@/lib/adeli/browser";
import { AdeliError, type AdeliAccount } from "@/lib/adeli/types";
import { connectAccount } from "@/lib/actions";
import { cn } from "@adeli-chat/ui/lib/utils";

type Flow =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; sessionId: string; authUrl: string; processing: boolean }
  | { kind: "saving" }
  | { kind: "failed"; message: string };

/**
 * Connect Instagram with Instagram Login (D11) on the user's own Adeli
 * profile. Adeli runs the login; once it finishes, the new account is saved
 * and you go to your automations. Accounts already on the profile (say you
 * connected before) are listed too, so you can pick one instead.
 */
export function ConnectCard({ currentAccountId }: { currentAccountId: string | null }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdeliAccount[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentAccountId);
  const [saving, startSaving] = useTransition();
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

  async function startConnect() {
    setFlow({ kind: "starting" });
    const authWindow = window.open("about:blank", "_blank");
    try {
      const session = await adeli.startConnect();
      if (authWindow) authWindow.location.href = session.authUrl;
      setFlow({ kind: "waiting", sessionId: session.id, authUrl: session.authUrl, processing: false });
      stopPolling();
      pollTimer.current = setInterval(async () => {
        try {
          const next = await adeli.getConnectSession(session.id);
          if (next.status === "processing") setFlow({ kind: "waiting", sessionId: session.id, authUrl: session.authUrl, processing: true });
          if (next.status === "connected" && next.accountId) {
            stopPolling();
            await saveConnected(next.accountId);
          }
          if (next.status === "failed" || next.status === "expired") {
            stopPolling();
            setFlow({ kind: "failed", message: next.error ?? "Instagram didn't finish connecting." });
          }
        } catch (error) {
          stopPolling();
          setFlow({ kind: "failed", message: error instanceof AdeliError ? error.message : "We couldn't check the Instagram connection. Try again." });
        }
      }, 1000);
    } catch (error) {
      authWindow?.close();
      setFlow({ kind: "failed", message: error instanceof AdeliError ? error.message : "We couldn't reach Adeli. Try again in a minute." });
    }
  }

  /** Saves the account Instagram Login just connected and moves on. */
  async function saveConnected(accountId: string) {
    setFlow({ kind: "saving" });
    const result = await connectAccount(accountId);
    if (!result.ok) {
      setFlow({ kind: "failed", message: result.reason === "error" ? result.message : "We couldn't save that account. Try again." });
      void loadAccounts();
      return;
    }
    toast.success(`Connected @${result.handle}`);
    router.push("/automations");
  }

  function cancel() {
    stopPolling();
    setFlow({ kind: "idle" });
  }

  function useAccount() {
    if (!selected) return;
    startSaving(async () => {
      const result = await connectAccount(selected);
      if (!result.ok) {
        toast.error(result.reason === "error" ? result.message : "We couldn't save that account. Try again.");
        return;
      }
      toast.success(`Using @${result.handle}`);
      router.push("/automations");
    });
  }

  const hasAccounts = Boolean(accounts?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><AtSign className="size-4 text-link" /> Connect your Instagram account</CardTitle>
        <CardDescription>
          LedaChat replies to comments and sends DMs from this account. It needs to be an Instagram Business or Creator account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            <span>We couldn&apos;t load your Instagram accounts from Adeli.</span>
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
        ) : null}

        <ConnectNew flow={flow} primary={!hasAccounts} hasAccounts={hasAccounts} onStart={() => void startConnect()} onCancel={cancel} />

        {hasAccounts ? (
          <div className="flex justify-end border-t pt-4">
            <Button size="lg" onClick={useAccount} disabled={!selected || flow.kind === "waiting" || flow.kind === "saving" || saving}>{saving ? <Loader2 className="animate-spin" /> : null} Use this account</Button>
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
      {needsReconnect ? <Badge className="bg-warning-wash text-warning"><AlertTriangle /> Connect again</Badge> : null}
      <span className={cn("grid size-5 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {selected ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

function ConnectNew({ flow, primary, hasAccounts, onStart, onCancel }: { flow: Flow; primary: boolean; hasAccounts: boolean; onStart: () => void; onCancel: () => void }) {
  if (flow.kind === "saving") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-secondary/40 p-4 text-sm font-medium text-secondary-foreground" role="status" aria-live="polite">
        <Loader2 className="size-4 animate-spin" /> Instagram connected. Saving your account…
      </div>
    );
  }
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
          <a href={flow.authUrl || "https://www.instagram.com/"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-link underline-offset-4 hover:underline">Open Instagram login again <ExternalLink className="size-3" /></a>
          <button type="button" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onCancel}>Cancel</button>
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
      <Button variant={primary ? "default" : "outline"} size="lg" onClick={onStart} disabled={flow.kind === "starting"}>
        {flow.kind === "starting" ? <Loader2 className="animate-spin" /> : <Plus />}
        {flow.kind === "failed" ? "Try again" : hasAccounts ? "Connect another account" : "Connect Instagram"}
      </Button>
      <p className="text-xs text-muted-foreground">Opens Instagram in a new tab. Adeli handles the login, so LedaChat never sees your password.</p>
    </div>
  );
}
