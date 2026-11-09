"use client";

import { Asterisk, Check, Copy, ExternalLink, KeyRound, Loader2, Plug, Plus, Sparkles, Terminal, Unplug } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { createApiToken, disconnectMcpApp, revokeApiToken } from "@/lib/actions";
import { relativeTime, shortDate } from "@/lib/format";
import type { ConnectedApp } from "@/lib/mcp/connections";
import { claudeCodeCommand, claudeConnectorLink, manualConfig } from "@/lib/mcp/install-links";
import type { ApiToken, TokenExpiry } from "@/lib/mcp/tokens";
import { cn } from "@/lib/utils";

/**
 * Settings for the MCP endpoint, laid out like Twenty's "MCP & APIs" page:
 * quick install (Claude connector link, Claude Code command), the manual JSON
 * config, API tokens, and apps connected through OAuth.
 */
export function McpSettings({ mcpUrl, oauthEnabled, tokens, apps }: { mcpUrl: string; oauthEnabled: boolean; tokens: ApiToken[]; apps: ConnectedApp[] }) {
  // A token just created, shown once and filled into the snippets until the page is left.
  const [newToken, setNewToken] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> MCP</CardTitle>
          <CardDescription>Connect Claude, Claude Code, Cursor or any MCP client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Server URL</Label>
            <CopyField value={mcpUrl} />
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Quick install</h3>
              <p className="text-sm text-muted-foreground">Open Claude with Adeli Chat filled in, or add it to Claude Code.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InstallTile
                icon={<Asterisk className="size-5" />}
                title="Claude"
                badge="Preset link"
                description={oauthEnabled ? "Adds Adeli Chat as a custom connector. You'll sign in with Google and choose what Claude can do." : "Needs Google sign-in, which is off on this install. Use an API token below instead."}
                action={oauthEnabled ? (
                  <a href={claudeConnectorLink(mcpUrl)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}><ExternalLink /> Install</a>
                ) : null}
              />
              <InstallTile
                icon={<Terminal className="size-5" />}
                title="Claude Code"
                badge="Command"
                description={newToken ? "Includes the token you just created." : "Create an API token below, then paste it into the command."}
                action={<CopyButton value={claudeCodeCommand(mcpUrl, newToken ?? undefined)} label="Copy" />}
              >
                <code className="block rounded-md bg-muted px-3 py-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap break-all">{claudeCodeCommand(mcpUrl, newToken ?? undefined)}</code>
              </InstallTile>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Manual configuration</h3>
              <p className="text-sm text-muted-foreground">For Cursor, Claude Desktop, Windsurf and other clients that take an <code className="font-mono text-[0.82rem]">mcpServers</code> config. Use an API token from below.</p>
            </div>
            <CodeBlock title="MCP client configuration" code={manualConfig(mcpUrl, newToken ?? undefined)} />
          </section>
        </CardContent>
      </Card>

      <TokensCard tokens={tokens} newToken={newToken} onCreated={setNewToken} />
      {oauthEnabled || apps.length ? <ConnectedAppsCard apps={apps} /> : null}
    </>
  );
}

function InstallTile({ icon, title, badge, description, action, children }: { icon: React.ReactNode; title: string; badge: string; description: string; action: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          <Badge variant="secondary">{badge}</Badge>
          {action ? <span className="ml-auto shrink-0">{action}</span> : null}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

function TokensCard({ tokens, newToken, onCreated }: { tokens: ApiToken[]; newToken: string | null; onCreated: (token: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> API tokens</CardTitle>
        <CardDescription>For clients that send an Authorization header. A token reaches only your automations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken ? (
          <div className="space-y-2 rounded-lg bg-secondary p-4 text-secondary-foreground">
            <p className="text-sm font-medium">Copy your new token now. You won&apos;t see it again.</p>
            <CopyField value={newToken} />
          </div>
        ) : null}

        {tokens.length ? (
          <ul className="divide-y rounded-lg border">
            {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-medium">{token.name}</span>
                  <code className="font-mono text-[0.82rem] text-muted-foreground">{token.prefix}…</code>
                  {token.readOnly ? <Badge variant="outline">Read only</Badge> : null}
                  {token.expired ? <Badge className="bg-destructive/10 text-destructive">Expired</Badge> : null}
                  <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
                    Created {shortDate(token.createdAt)} · {token.lastUsedAt ? `Used ${relativeTime(token.lastUsedAt)}` : "Never used"} · {expiryText(token)}
                  </span>
                  <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => setRevoking(token)}>Revoke</Button>
                </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        )}
        <Button variant="outline" onClick={() => setCreating(true)}><Plus /> Create token</Button>
      </CardContent>

      <CreateTokenDialog open={creating} onOpenChange={setCreating} onCreated={onCreated} />

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

const EXPIRY_LABELS: Record<TokenExpiry, string> = { never: "Never", "30d": "30 days", "90d": "90 days", "365d": "1 year" };

function expiryText(token: ApiToken) {
  if (!token.expiresAt || token.daysLeft === null) return "Never expires";
  if (token.expired) return `Expired ${shortDate(token.expiresAt)}`;
  return `Expires in ${token.daysLeft} ${token.daysLeft === 1 ? "day" : "days"}`;
}

function CreateTokenDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (token: string) => void }) {
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
      onCreated(result.token);
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
            <DialogDescription>Use it as a Bearer token for {"/mcp"}. You&apos;ll see it once.</DialogDescription>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plug className="size-4 text-primary" /> Connected apps</CardTitle>
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
          <p className="text-sm text-muted-foreground">Nothing connected yet. Use the Claude install link above.</p>
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

function CopyButton({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="outline" size="sm" onClick={() => void copy(value)}>
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
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

function CodeBlock({ title, code }: { title: string; code: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span>{title}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Copy configuration" onClick={() => void copy(code)}>{copied ? <Check /> : <Copy />}</Button>
      </div>
      <pre className="overflow-x-auto bg-background p-4 font-mono text-[0.82rem] leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}
