"use client";

import { CheckCircle2, Loader2, LogOut, Palette, RefreshCw, AtSign, UserRound, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { ThemeToggle } from "@adeli-chat/ui/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@adeli-chat/ui/components/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@adeli-chat/ui/components/avatar";
import { Badge } from "@adeli-chat/ui/components/badge";
import { Button } from "@adeli-chat/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@adeli-chat/ui/components/card";
import { Input } from "@adeli-chat/ui/components/input";
import { Label } from "@adeli-chat/ui/components/label";
import { disconnectAccount, renameLocalProfile, signOut } from "@/lib/actions";
import type { AdeliAccount } from "@/lib/adeli/types";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * What Settings shows about Adeli. The key itself is the server's `ADELI_API_KEY` and never reaches the browser.
 * `localProfile`: local development without login, where the profile can be renamed.
 */
export type AdeliStatus = { configured: boolean; rejected: boolean; baseURL: string; profileName: string | null; localProfile: boolean };

export function SettingsView({ adeli, account, user, liveCount }: { adeli: AdeliStatus; account: AdeliAccount | null; user: CurrentUser | null; liveCount: number }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeading title="Settings" description="Your Instagram account and preferences." />
      <div className="grid gap-4">
        {adeli.localProfile && adeli.configured ? <LocalProfileCard profileName={adeli.profileName} /> : null}
        <InstagramCard account={account} liveCount={liveCount} canConnect={adeli.configured} />
        <AppearanceCard />
        {user ? <SignedInCard user={user} /> : null}
      </div>
    </div>
  );
}

/** Local development only: names this machine's Adeli profile, so developers sharing a key can tell theirs apart. */
function LocalProfileCard({ profileName }: { profileName: string | null }) {
  const [name, setName] = useState(profileName ?? "");
  const [saving, setSaving] = useState(false);
  const unchanged = name.trim() === (profileName ?? "") || !name.trim();

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await renameLocalProfile(name);
    setSaving(false);
    if (result.ok) {
      setName(result.profileName);
      toast.success("Profile renamed");
    } else toast.error(result.reason === "error" ? result.message : "We couldn't rename the profile.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench className="size-4 text-link" /> Local profile <Badge variant="secondary">Dev only</Badge></CardTitle>
        <CardDescription>This local database has its own Adeli profile. Name it so you can tell it apart from other developers using the same key.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-56 flex-1 gap-1.5">
            <Label htmlFor="local-profile-name">Profile name</Label>
            <Input id="local-profile-name" value={name} maxLength={200} placeholder="Local: you on your laptop" onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="submit" disabled={saving || unchanged}>{saving ? <Loader2 className="animate-spin" /> : null} Save</Button>
        </form>
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
              This only removes it from LedaChat. You can connect it again any time.
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
