"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, RefreshCw, ServerCog, AtSign, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectAccount, testConnection, type KeyState } from "@/lib/actions";
import type { AdeliAccount } from "@/lib/adeli/types";
import { relativeTime } from "@/lib/format";

export function SettingsView({ keyState, account, liveCount }: { keyState: KeyState; account: AdeliAccount | null; liveCount: number }) {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeading title="Settings" description="Your Adeli connection, Instagram account and session." />
      <div className="grid max-w-3xl gap-4">
        <AdeliKeyCard keyState={keyState} />
        <InstagramCard account={account} liveCount={liveCount} canConnect={keyState.configured} />
        <SessionCard />
      </div>
    </div>
  );
}

function AdeliKeyCard({ keyState: key }: { keyState: KeyState }) {
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    const result = await testConnection();
    setTesting(false);
    if (result.ok) toast.success("Adeli accepted your key");
    else toast.error(result.reason === "error" ? result.message : "Adeli didn't accept this key.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Adeli</CardTitle>
        <CardDescription>Adeli Chat talks to Instagram through your Adeli account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {key.configured ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {key.status === "valid" ? (
                  <Badge variant="secondary"><CheckCircle2 /> Working</Badge>
                ) : key.status === "invalid" ? (
                  <Badge className="bg-destructive/10 text-destructive"><XCircle /> Rejected by Adeli</Badge>
                ) : (
                  <Badge variant="outline">Not checked yet</Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">Key</dt>
              <dd className="font-mono text-[0.82rem]">{key.prefix}</dd>
              <dt className="text-muted-foreground">Adeli profile</dt>
              <dd className="font-medium">{key.profileName ?? "Not checked yet"}</dd>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd>{key.checkedAt ? relativeTime(key.checkedAt) : "Never"}</dd>
            </dl>
            <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <ServerCog className="mt-px size-3.5 shrink-0" />
              <span>Managed by your server environment (<code className="font-mono">ADELI_API_KEY</code>). To change it, update the variable and restart.</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void test()} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Test connection</Button>
              <a href="https://app.tryadeli.com/settings/api-keys" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "link" })}>Manage keys in Adeli <ExternalLink /></a>
            </div>
          </>
        ) : (
          <div className="flex gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{key.message} <Link href="/setup" className="font-semibold underline underline-offset-4">How to get a key</Link></span>
          </div>
        )}
      </CardContent>

    </Card>
  );
}

function InstagramCard({ account, liveCount, canConnect }: { account: AdeliAccount | null; liveCount: number; canConnect: boolean }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AtSign className="size-4 text-primary" /> Instagram account</CardTitle>
        <CardDescription>The account your automations reply and DM from.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
                <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">@{account.displayIdentifier}</p>
                <p className="truncate text-sm text-muted-foreground">{account.displayName}</p>
              </div>
              <Badge variant="secondary" className="ml-auto"><CheckCircle2 /> Connected</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/connect")} disabled={!canConnect}><RefreshCw /> Reconnect or switch</Button>
              <Button variant="destructive" onClick={() => setDisconnecting(true)}>Disconnect</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No Instagram account connected.</p>
            <Button onClick={() => router.push("/connect")} disabled={!canConnect}>Connect Instagram</Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={disconnecting} onOpenChange={setDisconnecting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect @{account?.displayIdentifier}?</AlertDialogTitle>
            <AlertDialogDescription>
              {liveCount ? `Your ${liveCount} live ${liveCount === 1 ? "automation" : "automations"} will be paused. ` : ""}
              This only removes it from Adeli Chat. The account stays connected in Adeli, where you can remove it fully.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
                const result = await disconnectAccount();
                setDisconnecting(false);
                if (result.ok) toast("Instagram disconnected");
                else toast.error(result.reason === "error" ? result.message : "We couldn't disconnect. Try again.");
              }}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SessionCard() {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>You stay logged in on this device for 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }}><LogOut /> Log out</Button>
      </CardContent>
    </Card>
  );
}
