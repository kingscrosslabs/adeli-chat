"use client";

import { Check, Copy, KeyRound, Loader2, Plug, Plus, Sparkles, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { ConnectToAgent } from "@/components/settings/agent-connect";
import { maskToken, RevealableToken, useTokenSecret } from "@/components/settings/revealable-token";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { createApiToken, disconnectMcpApp, revokeApiToken } from "@/lib/actions";
import { relativeTime, shortDate } from "@/lib/format";
import type { ConnectedApp } from "@/lib/mcp/connections";
import type { ApiToken, TokenExpiry } from "@/lib/mcp/tokens";
import { cn } from "@/lib/utils";

/**
 * Settings for the MCP endpoint: the server URL, a setup guide per agent
 * (Claude, ChatGPT, Cursor, Perplexity, any MCP client), API tokens, and apps
 * connected through OAuth.
 */
export function McpSettings({ mcpUrl, oauthEnabled, defaultToken, tokens, apps }: { mcpUrl: string; oauthEnabled: boolean; defaultToken: ApiToken; tokens: ApiToken[]; apps: ConnectedApp[] }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-link" /> Connect to Agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Server URL</Label>
            <CopyField value={mcpUrl} />
            <p className="text-sm text-muted-foreground">Install this MCP to connect Adeli Chat to Claude, ChatGPT, Cursor or Perplexity.</p>
          </div>
          <ConnectToAgent mcpUrl={mcpUrl} oauthEnabled={oauthEnabled} apps={apps} defaultToken={defaultToken} />
        </CardContent>
      </Card>

      <TokensCard tokens={tokens} />
      {oauthEnabled || apps.length ? <ConnectedAppsCard apps={apps} /> : null}
    </>
  );
}

function TokensCard({ tokens }: { tokens: ApiToken[] }) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  return (
    <Card id="api-tokens" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-link" /> API tokens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokens.length ? (
          <ul className="divide-y rounded-lg border">
            {tokens.map((token) => <TokenRow key={token.id} token={token} onRevoke={() => setRevoking(token)} />)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        )}
        <Button variant="outline" onClick={() => setCreating(true)}><Plus /> Create token</Button>
      </CardContent>

      <CreateTokenDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &quot;{revoking?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>Anything using this token stops working right away. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              if (!revoking) return;
              const result = await revokeApiToken(revoking.id);
              setRevoking(null);
              if (result.ok) toast("Token revoked");
              else toast.error(result.reason === "error" ? result.message : "We couldn't revoke the token. Try again.");
            }}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function TokenRow({ token, onRevoke }: { token: ApiToken; onRevoke: () => void }) {
  const tokenSecret = useTokenSecret(token.revealable ? token.id : null);
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-3 text-sm">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{token.name}</span>
          {token.readOnly ? <Badge variant="outline">Read only</Badge> : null}
          {token.expired ? <Badge className="bg-destructive/10 text-destructive">Expired</Badge> : null}
        </div>
        {token.revealable ? (
          <RevealableToken prefix={token.prefix} tokenSecret={tokenSecret} />
        ) : (
          <>
            <code className="block font-mono text-[0.82rem] text-muted-foreground">{maskToken(token.prefix)}</code>
            <p className="text-xs text-muted-foreground">Created before tokens could be revealed. Create a new one to get one you can reveal.</p>
          </>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <Button variant="ghost" size="sm" className="text-destructive" onClick={onRevoke}>Revoke</Button>
        <p className="text-xs text-muted-foreground">Created {shortDate(token.createdAt)}</p>
        {token.lastUsedAt ? <p className="text-xs text-muted-foreground">Used {relativeTime(token.lastUsedAt)}</p> : null}
        {token.expiresAt ? <p className="text-xs text-muted-foreground">{expiryText(token)}</p> : null}
      </div>
    </li>
  );
}

const EXPIRY_LABELS: Record<TokenExpiry, string> = { never: "Never", "30d": "30 days", "90d": "90 days", "365d": "1 year" };

function expiryText(token: ApiToken) {
  if (!token.expiresAt || token.daysLeft === null) return "Never expires";
  if (token.expired) return `Expired ${shortDate(token.expiresAt)}`;
  return `Expires in ${token.daysLeft} ${token.daysLeft === 1 ? "day" : "days"}`;
}

function CreateTokenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("Claude Code");
  const [readOnly, setReadOnly] = useState(false);
  const [expiry, setExpiry] = useState<TokenExpiry>("never");
  const [pending, startTransition] = useTransition();

  function create(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createApiToken({ name, readOnly, expiry });
      if (!result.ok) {
        toast.error(result.reason === "error" ? result.message : "We couldn't create the token. Try again.");
        return;
      }
      toast.success("Token created", { description: "Reveal or copy it from the list." });
      onOpenChange(false);
      setName("Claude Code");
      setReadOnly(false);
      setExpiry("never");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={create} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create API token</DialogTitle>
            <DialogDescription>Use it as a Bearer token for {"/mcp"}. You can reveal it again from the list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="token-name">Name</Label>
            <Input id="token-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Claude Code" />
          </div>
          <div className="space-y-2">
            <Label>Expires</Label>
            <RadioGroup value={expiry} onValueChange={(value) => setExpiry(value as TokenExpiry)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(EXPIRY_LABELS) as TokenExpiry[]).map((option) => (
                <label key={option} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", expiry === option && "border-primary bg-accent")}>
                  <RadioGroupItem value={option} />
                  {EXPIRY_LABELS[option]}
                </label>
              ))}
            </RadioGroup>
          </div>
          <label className="flex items-start justify-between gap-4 rounded-lg border px-3 py-3 text-sm">
            <span>
              <span className="block font-medium">Read only</span>
              <span className="text-muted-foreground">Can list and read automations, but not change them.</span>
            </span>
            <Switch checked={readOnly} onCheckedChange={setReadOnly} aria-label="Read only" />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Create token</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConnectedAppsCard({ apps }: { apps: ConnectedApp[] }) {
  const [disconnecting, setDisconnecting] = useState<ConnectedApp | null>(null);

  return (
    <Card id="connected-apps" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plug className="size-4 text-link" /> Connected apps</CardTitle>
        <CardDescription>Apps you allowed through sign-in, like Claude&apos;s Adeli Chat connector.</CardDescription>
      </CardHeader>
      <CardContent>
        {apps.length ? (
          <ul className="divide-y rounded-lg border">
            {apps.map((app) => (
              <li key={app.clientId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{app.name}</span>
                <Badge variant={app.canWrite ? "secondary" : "outline"}>{app.canWrite ? "Can make changes" : "Read only"}</Badge>
                <span className="text-xs text-muted-foreground">Connected {relativeTime(app.connectedAt)}</span>
                <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => setDisconnecting(app)}><Unplug /> Disconnect</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing connected yet. Pick your agent above to connect it.</p>
        )}
      </CardContent>

      <AlertDialog open={disconnecting !== null} onOpenChange={(open) => !open && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnecting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It will need your permission again to reach your automations. Access it already has ends within an hour.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              if (!disconnecting) return;
              const result = await disconnectMcpApp(disconnecting.clientId);
              setDisconnecting(null);
              if (result.ok) toast("App disconnected");
              else toast.error(result.reason === "error" ? result.message : "We couldn't disconnect it. Try again.");
            }}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }
  return { copied, copy };
}

function CopyField({ value }: { value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[0.82rem]">{value}</code>
      <Button variant="ghost" size="icon-sm" aria-label="Copy" onClick={() => void copy(value)}>{copied ? <Check /> : <Copy />}</Button>
    </div>
  );
}
