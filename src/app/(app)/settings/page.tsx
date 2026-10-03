"use client";

import { CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, RefreshCw, ServerCog, AtSign, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Guard } from "@/components/guard";
import { AdeliKeyForm } from "@/components/onboarding/adeli-key-form";
import { GetKeyInstructions } from "@/components/onboarding/get-key-instructions";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { actions, useDemoState } from "@/lib/demo/store";
import { relativeTime } from "@/lib/format";

export default function SettingsPage() {
  return (
    <Guard require="session">
      <div className="space-y-6 p-4 md:p-8">
        <PageHeading title="Settings" description="Your Adeli connection, Instagram account and session." />
        <div className="grid max-w-3xl gap-4">
          <AdeliKeyCard />
          <InstagramCard />
          <SessionCard />
        </div>
      </div>
    </Guard>
  );
}

function AdeliKeyCard() {
  const state = useDemoState();
  const key = state?.adeliKey;
  const liveCount = state?.automations.filter((automation) => automation.status === "live").length ?? 0;
  const [testing, setTesting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function test() {
    if (!key) return;
    setTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setTesting(false);
    actions.markKeyChecked(key.status);
    if (key.status === "valid") toast.success("Adeli accepted your key");
    else toast.error("Adeli still rejects this key. Replace it with a new one.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Adeli</CardTitle>
        <CardDescription>Adeli Chat talks to Instagram through your Adeli account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {key ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {key.status === "valid" ? (
                  <Badge variant="secondary"><CheckCircle2 /> Working</Badge>
                ) : (
                  <Badge className="bg-destructive/10 text-destructive"><XCircle /> Rejected by Adeli</Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">Key</dt>
              <dd className="font-mono text-[0.82rem]">{key.prefix}</dd>
              <dt className="text-muted-foreground">Adeli profile</dt>
              <dd className="font-medium">{key.profileName}</dd>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd>{relativeTime(key.checkedAt)}</dd>
            </dl>
            {key.source === "env" ? (
              <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ServerCog className="mt-px size-3.5 shrink-0" />
                <span>Managed by your server environment (<code className="font-mono">ADELI_API_KEY</code>). To change it, update the variable and restart.</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void test()} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Test connection</Button>
              {key.source === "ui" ? (
                <>
                  <Button variant="outline" onClick={() => setReplacing(true)}>Replace key</Button>
                  <Button variant="destructive" onClick={() => setRemoving(true)}>Remove key</Button>
                </>
              ) : null}
              <a href="https://app.tryadeli.com/settings/api-keys" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "link" })}>Manage keys in Adeli <ExternalLink /></a>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No key yet. Your automations can&apos;t run without one.</p>
            <Link href="/setup" className={buttonVariants()}>Add an Adeli key</Link>
          </div>
        )}
      </CardContent>

      <Dialog open={replacing} onOpenChange={setReplacing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace your Adeli key</DialogTitle>
            <DialogDescription>Create a new key in Adeli and paste it here. The old key keeps working in Adeli until you delete it there.</DialogDescription>
          </DialogHeader>
          <details className="rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">How do I get a key?</summary>
            <div className="mt-3"><GetKeyInstructions /></div>
          </details>
          <AdeliKeyForm submitLabel="Save new key" onSaved={() => { setReplacing(false); toast.success("New key saved"); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your Adeli key?</AlertDialogTitle>
            <AlertDialogDescription>
              Adeli Chat won&apos;t be able to reply or send DMs until you add a key again.
              {liveCount ? ` Your ${liveCount} live ${liveCount === 1 ? "automation" : "automations"} will be paused.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { actions.removeKey(); setRemoving(false); toast("Adeli key removed"); }}>Remove key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function InstagramCard() {
  const state = useDemoState();
  const router = useRouter();
  const account = state?.account;
  const liveCount = state?.automations.filter((automation) => automation.status === "live").length ?? 0;
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
              <Button variant="outline" onClick={() => router.push("/connect")} disabled={!state?.adeliKey}><RefreshCw /> Reconnect or switch</Button>
              <Button variant="destructive" onClick={() => setDisconnecting(true)}>Disconnect</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No Instagram account connected.</p>
            <Button onClick={() => router.push("/connect")} disabled={!state?.adeliKey}>Connect Instagram</Button>
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
            <AlertDialogAction variant="destructive" onClick={() => { actions.disconnectAccount(); setDisconnecting(false); toast("Instagram disconnected"); }}>Disconnect</AlertDialogAction>
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
        <Button variant="outline" onClick={() => { actions.logout(); router.replace("/login"); }}><LogOut /> Log out</Button>
      </CardContent>
    </Card>
  );
}
