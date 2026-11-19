import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@adeli-chat/ui/lib/utils";

import { SiteFooter, SiteHeader, TITLE_UNDERLINE } from "@/components/site-chrome";
import { APP_URL, GITHUB_URL } from "@/lib/links";
import { breadcrumbs, graph, jsonLdScript, organization, website } from "@/lib/schema";

/**
 * /docs/mcp: how to connect LedaChat's MCP server to Claude (claude.ai, the
 * Claude Code plugin or `claude mcp add`), Codex, Cursor, VS Code and other clients,
 * and what its tools do. The Claude Code plugin's `documentationUrl` and the
 * Claude Connectors Directory listing point here, so keep it public and in
 * step with `apps/web/src/lib/mcp/` and `plugins/ledachat/`.
 */

const TITLE = "Connect LedaChat to Claude and other AI agents";
const DESCRIPTION =
  "Set up LedaChat's MCP server in Claude, Claude Code, Codex or Cursor, then create and run Instagram comment to DM automations by asking your AI agent.";

const SERVER = `${APP_URL}/mcp`;
/** Where MCP support questions go. The Claude and ChatGPT directory listings show this page as the support contact. */
const SUPPORT_EMAIL = "hello@kingscrosslabs.com";
const MARKETPLACE = "kingscrosslabs/ledachat";
const CLAUDE_CONNECTOR_LINK = `https://claude.ai/customize/connectors?${new URLSearchParams({ modal: "add-custom-connector", connectorName: "LedaChat", connectorUrl: SERVER }).toString()}`;
const VSCODE_INSTALL_LINK = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "ledachat", type: "http", url: SERVER }))}`;
const CURSOR_INSTALL_LINK = `cursor://anysphere.cursor-deeplink/mcp/install?${new URLSearchParams({ name: "ledachat", config: Buffer.from(JSON.stringify({ url: SERVER })).toString("base64") }).toString()}`;

const TOOLS: ReadonlyArray<{ name: string; kind: "Read" | "Write"; what: string }> = [
  { name: "get_workspace", kind: "Read", what: "Who is signed in, the connected Instagram account, automation counts and the plan." },
  { name: "connect_instagram", kind: "Write", what: "A one-time link for connecting an Instagram account, when none is connected yet." },
  { name: "list_automations", kind: "Read", what: "Every automation, with its trigger, post, status and stats." },
  { name: "get_automation", kind: "Read", what: "Everything about one automation: trigger, replies, DMs, status and stats." },
  { name: "list_posts", kind: "Read", what: "Recent posts and reels, to pick the post an automation runs on." },
  { name: "list_stories", kind: "Read", what: "Live stories, for story reply automations." },
  { name: "list_audience", kind: "Read", what: "Who engages with your automations, most engaged first." },
  { name: "create_automation", kind: "Write", what: "Creates a draft. Nothing runs until it goes live." },
  { name: "update_automation", kind: "Write", what: "Changes some fields of an automation and keeps the rest." },
  { name: "go_live", kind: "Write", what: "Starts an automation after checking every field." },
  { name: "pause_automation", kind: "Write", what: "Stops an automation." },
  { name: "duplicate_automation", kind: "Write", what: "Copies an automation into a new draft." },
  { name: "delete_automation", kind: "Write", what: "Deletes an automation and its history. Can't be undone." },
  { name: "message_earlier_comments", kind: "Write", what: "Counts, then (once you agree) messages people who commented in the last 24 hours, before the automation went live." },
  { name: "reset_runs", kind: "Write", what: "Forgets who an automation has messaged, so they can trigger it again. Handy for testing." },
];

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | LedaChat` },
  description: DESCRIPTION,
  alternates: { canonical: "/docs/mcp" },
  openGraph: { type: "article", url: "/docs/mcp", siteName: "LedaChat", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function Code({ children }: { children: string }) {
  return <pre><code>{children}</code></pre>;
}

export default function McpDocs() {
  const structuredData = graph([
    organization(),
    website(),
    breadcrumbs([
      { name: "LedaChat", path: "/" },
      { name: "MCP docs", path: "/docs/mcp" },
    ]),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      <SiteHeader />
      <main>
        <header className="bg-muted px-4 pt-12 pb-10 sm:px-6 md:pt-16">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <h1 className={cn("text-3xl font-semibold tracking-tight text-balance md:text-4xl", TITLE_UNDERLINE)}>{TITLE}</h1>
            <p className="text-lg">{DESCRIPTION}</p>
            <div className="mt-2 rounded-xl border bg-card p-5">
              <p className="text-sm font-semibold">MCP server URL</p>
              <p className="mt-2 font-mono text-base break-all">{SERVER}</p>
              <p className="mt-2 text-sm">Streamable HTTP. Sign-in is OAuth with Google, so there&apos;s no token to paste.</p>
            </div>
          </div>
        </header>

        <div className="px-4 pt-10 pb-16 sm:px-6">
          <article className="blog-prose mx-auto max-w-2xl">
            <p>
              LedaChat is a free, open-source Instagram comment to DM tool. Its MCP server lets an AI agent do anything the app does: create an
              automation for your latest reel, put it live, pause it, or tell you who engaged. Connect it once, then ask in plain words, for example
              &ldquo;Set up a comment to DM on my latest reel. When someone comments GUIDE, send them my guide link.&rdquo;
            </p>

            <h2 id="claude">Claude (claude.ai and Claude Desktop)</h2>
            <ol>
              <li>
                Open <a href={CLAUDE_CONNECTOR_LINK}>Add custom connector in Claude</a>. The name and URL are filled in. Or go to Settings, then
                Connectors, choose Add custom connector, and paste <code>{SERVER}</code>.
              </li>
              <li>Choose Connect and sign in with Google. A new account is created the first time.</li>
              <li>On the consent screen, choose whether Claude may make changes or only read.</li>
            </ol>
            <p>On a Team or Enterprise plan, an owner may need to add the connector for the organization first.</p>

            <h2 id="claude-code">Claude Code</h2>
            <h3 id="claude-code-plugin">With the plugin (recommended)</h3>
            <p>LedaChat&apos;s GitHub repository is a Claude Code plugin marketplace. In Claude Code, run:</p>
            <Code>{`/plugin install ledachat --marketplace ${MARKETPLACE}`}</Code>
            <p>On older versions of Claude Code, add the marketplace first:</p>
            <Code>{`/plugin marketplace add ${MARKETPLACE}\n/plugin install ledachat@ledachat`}</Code>
            <p>
              Then type <code>/mcp</code>, pick <code>plugin:ledachat:ledachat</code> and choose Authenticate. Update later with{" "}
              <code>/plugin update ledachat@ledachat</code>.
            </p>
            <h3 id="claude-code-cli">Without the plugin</h3>
            <Code>{`claude mcp add --transport http ledachat ${SERVER}`}</Code>
            <p>Then type <code>/mcp</code> in Claude Code and choose Authenticate.</p>

            <h2 id="codex">Codex</h2>
            <Code>{`codex mcp add ledachat --url ${SERVER}\ncodex mcp login ledachat`}</Code>
            <p>Codex loads MCP tools when a session starts, so start a new session after signing in.</p>

            <h2 id="cursor">Cursor</h2>
            <p>
              <a href={CURSOR_INSTALL_LINK}>Add LedaChat to Cursor</a>, or add this to <code>mcp.json</code>, then sign in when Cursor asks:
            </p>
            <Code>{JSON.stringify({ mcpServers: { ledachat: { url: SERVER } } }, null, 2)}</Code>

            <h2 id="vscode">VS Code (GitHub Copilot)</h2>
            <p>
              <a href={VSCODE_INSTALL_LINK}>Add LedaChat to VS Code</a>, or run <code>MCP: Add Server</code> from the Command Palette, choose HTTP and
              paste <code>{SERVER}</code>. Start the server from the MCP view, then sign in when VS Code asks.
            </p>

            <h2 id="other-clients">ChatGPT, Perplexity and other clients</h2>
            <p>
              Any client that supports remote MCP servers with OAuth works with the server URL above. After you sign in to LedaChat, the{" "}
              <a href={`${APP_URL}/mcp-apis`}>Connect to AI Agent</a> page in the app has a step-by-step guide for each client, with your URL filled in.
            </p>
            <p>
              Clients that can&apos;t sign in with OAuth can send <code>Authorization: Bearer adc_...</code> with an API token from that page. Tokens can be
              read only, and can expire after 30, 90 or 365 days.
            </p>

            <h2 id="first-steps">Check the connection</h2>
            <p>
              Ask your agent to call <code>get_workspace</code>. It says who is signed in, which Instagram account is connected and which plan you&apos;re
              on. If no account is connected yet, the agent gives you a one-time link to connect one.
            </p>

            <h2 id="tools">Tools</h2>
            <table>
              <thead>
                <tr><th>Tool</th><th>Type</th><th>What it does</th></tr>
              </thead>
              <tbody>
                {TOOLS.map((tool) => (
                  <tr key={tool.name}><td><code>{tool.name}</code></td><td>{tool.kind}</td><td>{tool.what}</td></tr>
                ))}
              </tbody>
            </table>
            <p>
              New automations are always drafts. Tools use the same checks as the editor in the app, so an automation your agent puts live passes the
              same validation. Going live and messaging earlier comments send real DMs from your Instagram account, so your agent should confirm them
              with you first.
            </p>

            <h2 id="permissions">Permissions and disconnecting</h2>
            <ul>
              <li>A connection only reaches your own LedaChat account and its Instagram account.</li>
              <li>Turn off changes on the consent screen for a read-only connection. Write tools then return an error.</li>
              <li>Disconnect any client, or revoke an API token, on the <a href={`${APP_URL}/mcp-apis`}>Connect to AI Agent</a> page in the app.</li>
            </ul>

            <h2 id="self-hosting">Self-hosting</h2>
            <p>
              If you run your own copy of LedaChat, its MCP server is at <code>https://&lt;your-domain&gt;/mcp</code>. Use that URL in the steps above. The
              plugin points at the hosted LedaChat, so use <code>claude mcp add</code> instead. See the <a href={GITHUB_URL}>README on GitHub</a>.
            </p>

            <h2 id="support">Support</h2>
            <p>
              Questions or problems: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Back to the <Link href="/#mcp">MCP overview</Link>.
            </p>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
