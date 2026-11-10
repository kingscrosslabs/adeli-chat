"use client";

import { Check, ChevronLeft, Copy, ExternalLink, KeyRound } from "lucide-react";
import type { IconType } from "react-icons";
import { AiFillOpenAI } from "react-icons/ai";
import { SiClaude, SiPerplexity } from "react-icons/si";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConnectedApp } from "@/lib/mcp/connections";
import { MCP_DISPLAY_NAME } from "@/lib/mcp/config";
import { claudeCodeCommand, claudeConnectorLink, codexCommands, cursorConfig, cursorInstallLink } from "@/lib/mcp/install-links";
import type { ApiToken } from "@/lib/mcp/tokens";

import { RevealableToken, useTokenSecret } from "./revealable-token";
import { cn } from "@/lib/utils";

/** Cursor's mark, from LobeHub's open icon set (MIT), as Adeli's site uses it (`agent-logos.tsx`). */
function CursorLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z" />
    </svg>
  );
}

type Step = { title: string; body: React.ReactNode };
type Guide = { label: string; steps: Step[] };
type Agent = {
  id: "claude" | "chatgpt" | "cursor" | "perplexity" | "mcp";
  name: string;
  /** Owner's colours: a tile in the brand colour with a white mark (BRAND.md, "Logo and imagery"). */
  logo: { icon: IconType | typeof CursorLogo | typeof KeyRound; tile: string };
  guides: Guide[];
  /** Matches the name an OAuth client registered with, for the Connected badge. */
  clientName?: RegExp;
};

const PROMPTS = [
  "List my Adeli Chat automations and show which ones are live",
  "Create a draft automation that DMs my guide link to anyone who comments GUIDE on my next reel",
  "Which of my live automations sent the most final DMs?",
];

/** The "Connect to your agent" grid. A card opens that agent's setup guide in place, like Buffer's integrations page. */
export function ConnectToAgent({ mcpUrl, oauthEnabled, apps, defaultToken }: { mcpUrl: string; oauthEnabled: boolean; apps: ConnectedApp[]; defaultToken: Pick<ApiToken, "id" | "prefix"> }) {
  const [openId, setOpenId] = useState<Agent["id"] | null>(null);
  const tokenSecret = useTokenSecret(defaultToken.id);
  const token = { prefix: defaultToken.prefix, secret: tokenSecret };
  const agents = buildAgents(mcpUrl, oauthEnabled, token);
  const connections = (agent: Agent) => (agent.clientName ? apps.filter((app) => agent.clientName?.test(app.name)).length : 0);
  const open = agents.find((agent) => agent.id === openId);

  if (open) return <AgentGuide agent={open} connections={connections(open)} onBack={() => setOpenId(null)} />;

  return (
    <section className="space-y-3" aria-labelledby="connect-agent-heading">
      <h3 id="connect-agent-heading" className="text-sm font-medium">Connect to your agent</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setOpenId(agent.id)}
            className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AgentLogo agent={agent} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{agent.name}</span>
                {connections(agent) ? <Badge className="bg-success-wash text-success">Connected</Badge> : null}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AgentLogo({ agent, large }: { agent: Agent; large?: boolean }) {
  const Icon = agent.logo.icon;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-md text-white", large ? "size-12" : "size-10")} style={{ background: agent.logo.tile }}>
      <Icon className={large ? "size-7" : "size-6"} />
    </span>
  );
}

function AgentGuide({ agent, connections, onBack }: { agent: Agent; connections: number; onBack: () => void }) {
  return (
    <section className="space-y-6" aria-labelledby={`${agent.id}-guide-heading`}>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
        <ChevronLeft className="size-4" /> Connect to your agent
      </button>
      <div className="flex items-center gap-3">
        <AgentLogo agent={agent} large />
        <h3 id={`${agent.id}-guide-heading`} className="text-lg font-semibold">{agent.name}</h3>
      </div>
      {connections ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Connected</p>
            <p className="text-sm text-muted-foreground">{connections} {connections === 1 ? "connection" : "connections"}</p>
          </div>
          <a href="#connected-apps" className="text-sm text-link underline underline-offset-4">Manage connections</a>
        </div>
      ) : null}
      {agent.guides.length > 1 ? (
        <Tabs defaultValue={agent.guides[0].label}>
          <TabsList variant="line">
            {agent.guides.map((guide) => <TabsTrigger key={guide.label} value={guide.label}>{guide.label}</TabsTrigger>)}
          </TabsList>
          {agent.guides.map((guide) => <TabsContent key={guide.label} value={guide.label} className="pt-4"><Steps steps={guide.steps} /></TabsContent>)}
        </Tabs>
      ) : (
        <Steps steps={agent.guides[0].steps} />
      )}
      <div className="space-y-3">
        <h4 className="font-medium">Try it out</h4>
        <ul className="space-y-2">
          {PROMPTS.map((prompt) => (
            <li key={prompt} className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
              <span>{prompt}</span>
              <CopyIcon value={prompt} label="Copy prompt" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-link">{index + 1}</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-medium">{step.title}</p>
            <div className="space-y-2 text-sm text-muted-foreground">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
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

function CopyIcon({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={label} onClick={() => void copy(value)}>
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

/** An inline value with a copy button, like Buffer's `MCP Server URL: <url> [copy]`. */
function Value({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      <code className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground">{value}</code>
      <CopyIcon value={value} label={label} />
    </span>
  );
}

function Code({ code, label = "Copy" }: { code: string; label?: string }) {
  return (
    <div className="relative rounded-lg bg-code-background">
      <pre className="p-4 pr-12 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap break-all text-[#E6EEF8]"><code>{code}</code></pre>
      <span className="absolute top-2 right-2 text-[#E6EEF8]"><CopyIcon value={code} label={label} /></span>
    </div>
  );
}

function Fields({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map(([name, value]) => <li key={name}>{name}: {value}</li>)}
    </ul>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link underline underline-offset-4">{children}<ExternalLink className="size-3" /></a>;
}

const SIGN_IN = "A sign-in window opens. Sign in to Adeli Chat with Google and allow access.";

type DefaultToken = { prefix: string; secret: ReturnType<typeof useTokenSecret> };

function buildAgents(mcpUrl: string, oauthEnabled: boolean, token: DefaultToken): Agent[] {
  return [
    {
      id: "claude",
      name: "Claude",
      logo: { icon: SiClaude, tile: "#D97757" },
      clientName: /claude/i,
      guides: [
        {
          label: "Claude Code",
          steps: oauthEnabled ? [
            { title: "Add the server", body: <><p>Run this in your terminal. Add <code className="font-mono">--scope user</code> to use it in every project.</p><Code code={claudeCodeCommand(mcpUrl, null)} /></> },
            { title: "Sign in to Adeli Chat", body: <p>Start Claude Code, type <code className="font-mono">/mcp</code>, pick adeli-chat and choose Authenticate. {SIGN_IN}</p> },
            { title: "Finish", body: <p>adeli-chat shows as connected in <code className="font-mono">/mcp</code>.</p> },
          ] : [
            { title: "Add the server", body: <><p>Run this in your terminal. It uses your Default token.</p><RevealableToken block prefix={token.prefix} tokenSecret={token.secret} format={(value) => claudeCodeCommand(mcpUrl, value)} /></> },
            { title: "Finish", body: <p>Start Claude Code and type <code className="font-mono">/mcp</code>. adeli-chat shows as connected.</p> },
          ],
        },
        {
          label: "Claude Web/Desktop",
          steps: [
            { title: "Go to Claude", body: <p>Open Claude in your browser or desktop app. <Link href="https://claude.ai">claude.ai</Link></p> },
            { title: "Open Customize", body: <p>Click &quot;Customize&quot;, then &quot;Add&quot;, then &quot;Add custom connector&quot;. Or skip to step 4 with <Link href={claudeConnectorLink(mcpUrl)}>this link</Link>, which fills it in for you.</p> },
            { title: "Enter the server URL", body: <Fields items={[["Name", MCP_DISPLAY_NAME], ["Remote MCP server URL", <Value key="url" value={mcpUrl} label="Copy server URL" />]]} /> },
            { title: "Sign in to Adeli Chat", body: <p>Click &quot;Add&quot;, then &quot;Connect&quot;. {SIGN_IN}</p> },
            { title: "Finish", body: <p>Adeli Chat is in your connectors. Turn it on in a chat from the tools menu.</p> },
          ],
        },
      ],
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      logo: { icon: AiFillOpenAI, tile: "#0F0F0F" },
      clientName: /chatgpt|openai|codex/i,
      guides: [
        {
          label: "Codex CLI",
          steps: [
            { title: "Add the server", body: <><p>Run this in your terminal.</p><Code code={codexCommands(mcpUrl).add} /></> },
            { title: "Sign in to Adeli Chat", body: <><p>Then run this. {SIGN_IN}</p><Code code={codexCommands(mcpUrl).login} /></> },
            { title: "Finish", body: <p>Start Codex and type <code className="font-mono">/mcp</code>. adeli-chat is listed with its tools.</p> },
          ],
        },
        {
          label: "ChatGPT Web",
          steps: [
            { title: "Go to ChatGPT", body: <p>Open ChatGPT in your browser. <Link href="https://chatgpt.com">chatgpt.com</Link></p> },
            { title: "Turn on Developer mode", body: <p>Open Settings, find the Apps &amp; Connectors section, then turn on Developer mode under Advanced settings.</p> },
            { title: "Add a new app", body: <><p>Add a new app and fill in the form with:</p><Fields items={[["Name", MCP_DISPLAY_NAME], ["MCP Server URL", <Value key="url" value={mcpUrl} label="Copy server URL" />], ["Authentication", "OAuth"]]} /></> },
            { title: "Create and sign in", body: <><p>Click &quot;Create&quot;. {SIGN_IN}</p></> },
          ],
        },
      ],
    },
    {
      id: "cursor",
      name: "Cursor",
      logo: { icon: CursorLogo, tile: "#141414" },
      clientName: /cursor/i,
      guides: [
        {
          label: "Cursor",
          steps: [
            { title: "Open Cursor Settings", body: <p>In Cursor, open Cursor Settings, then the &quot;Tools &amp; MCP&quot; tab. Or skip to step 4 with <a href={cursorInstallLink(mcpUrl)} className="text-link underline underline-offset-4">Add to Cursor</a>.</p> },
            { title: "Add a new MCP server", body: <p>Click &quot;New MCP Server&quot;. That opens mcp.json.</p> },
            { title: "Enter the server URL", body: <><p>Paste this in. If the file already has an mcpServers block, add the adeli-chat entry inside it.</p><Code code={cursorConfig(mcpUrl)} label="Copy configuration" /></> },
            { title: "Sign in to Adeli Chat", body: <><p>Back in Tools &amp; MCP, click &quot;Connect&quot; next to adeli-chat. {SIGN_IN}</p></> },
            { title: "Finish", body: <p>adeli-chat shows a green dot and its tools. Ask the agent to list your automations.</p> },
          ],
        },
      ],
    },
    {
      id: "perplexity",
      name: "Perplexity",
      logo: { icon: SiPerplexity, tile: "#1F7A8C" },
      clientName: /perplexity/i,
      guides: [
        {
          label: "Perplexity",
          steps: [
            { title: "Open Perplexity", body: <p>Open Perplexity in your browser. <Link href="https://www.perplexity.ai">perplexity.ai</Link></p> },
            { title: "Open Connectors", body: <p>Go to &quot;All settings&quot;, then &quot;Connectors&quot;, and add a &quot;Custom connector&quot;.</p> },
            { title: "Add the custom connector", body: <><p>Fill in the form, check the consent box, and click &quot;Add&quot;:</p><Fields items={[["Name", MCP_DISPLAY_NAME], ["MCP Server URL", <Value key="url" value={mcpUrl} label="Copy server URL" />]]} /></> },
            { title: "Add the connector", body: <p>Under the &quot;Custom&quot; connectors list, find Adeli Chat and click &quot;Add connector&quot;.</p> },
            { title: "Sign in to Adeli Chat", body: <><p>{SIGN_IN}</p></> },
          ],
        },
      ],
    },
    {
      id: "mcp",
      name: "MCP",
      logo: { icon: KeyRound, tile: "#0A807A" },
      guides: [
        {
          label: "MCP",
          steps: [
            { title: "Configure your MCP client", body: <><p>Clients that support MCP and headers connect with an HTTP MCP server and these settings. The header uses your Default token.</p><Fields items={[["Server URL", <Value key="url" value={mcpUrl} label="Copy server URL" />], ["Authorization header", <RevealableToken key="auth" prefix={token.prefix} tokenSecret={token.secret} format={(value) => `Authorization: Bearer ${value}`} />]]} /></> },
          ],
        },
      ],
    },
  ];
}

