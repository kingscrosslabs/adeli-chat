"use client";

import { CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, Palette, RefreshCw, ServerCog, AtSign, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdeliConnectionForm } from "@/components/adeli/connection-form";
import { PageHeading } from "@/components/page-heading";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { disconnectAccount, signOut, testConnection, type KeyState } from "@/lib/actions";
import type { AdeliAccount } from "@/lib/adeli/types";
import type { CurrentUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/format";

export function SettingsView({ keyState, account, user, liveCount }: { keyState: KeyState; account: AdeliAccount | null; user: CurrentUser | null; liveCount: number }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeading title="Settings" description="Your Adeli connection and Instagram account." />
      <div className="grid gap-4">
        <AdeliKeyCard keyState={keyState} />
        <InstagramCard account={account} liveCount={liveCount} canConnect={keyState.configured} />
        <AppearanceCard />
        {user ? <SignedInCard user={user} /> : null}
      </div>
    </div>
  );
}

function AdeliKeyCard({ keyState: key }: { keyState: KeyState }) {
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);

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
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-link" /> Adeli</CardTitle>
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
              <dt className="text-muted-foreground">Adeli URL</dt>
              <dd className="font-mono text-[0.82rem]">{key.baseURL}</dd>
              <dt className="text-muted-foreground">Adeli profile</dt>
              <dd className="font-medium">{key.profileName ?? "Not checked yet"}</dd>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd>{key.checkedAt ? relativeTime(key.checkedAt) : "Never"}</dd>
            </dl>
            {key.source === "env" ? (
              <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ServerCog className="mt-px size-3.5 shrink-0" />
                <span>Read from <code className="font-mono">ADELI_API_KEY</code> on the server. A key saved below takes its place.</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void test()} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Test connection</Button>
              <Button variant="outline" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Change key or URL"}</Button>
              <a href="https://app.tryadeli.com/settings/api-keys" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "link" })}>Manage keys in Adeli <ExternalLink /></a>
            </div>
            {editing ? <AdeliConnectionForm hasKey={key.source === "settings"} baseURL={key.baseURL} onSaved={() => setEditing(false)} /> : null}
          </>
        ) : (
          <AdeliConnectionForm hasKey={false} baseURL={key.baseURL} submitLabel="Connect to Adeli" />
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
        <CardTitle className="flex items-center gap-2"><AtSign className="size-4 text-link" /> Instagram account</CardTitle>
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

function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="size-4 text-link" /> Appearance</CardTitle>
      </CardHeader>
      <CardContent><ThemeToggle className="flex w-full max-w-xs" /></CardContent>
    </Card>
  );
}

function SignedInCard({ user }: { user: CurrentUser }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-link" /> Signed in</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Avatar>
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOut} className="ml-auto">
          <Button type="submit" variant="outline"><LogOut /> Sign out</Button>
        </form>
      </CardContent>
    </Card>
  );
}
